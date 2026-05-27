const axios = require('axios');

const DEFAULT_SYSTEM_PROMPT =
  'You are a habit-building coach. Give short, realistic, actionable advice. Be supportive, not generic motivational spam. Keep responses under 80 words.';

const OPENAI_COMPATIBLE_DEFAULTS = {
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'openai/gpt-4o-mini',
  },
  xai: {
    url: 'https://api.x.ai/v1/chat/completions',
    model: 'grok-4-0709',
  },
  cerebras: {
    url: 'https://api.cerebras.ai/v1/chat/completions',
    model: 'gpt-oss-120b',
  },
  mistral: {
    url: 'https://api.mistral.ai/v1/chat/completions',
    model: 'mistral-small-latest',
  },
};

const GEMINI_DEFAULTS = {
  model: 'gemini-2.0-flash',
};

const extractTextFromOpenAIResponse = (data) => {
  const message = data?.choices?.[0]?.message?.content;
  if (!message) return null;
  return String(message).trim();
};

const extractTextFromGeminiResponse = (data) => {
  const candidate = data?.candidates?.[0];
  const parts = candidate?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const text = parts
    .map((p) => p?.text)
    .filter(Boolean)
    .join('\n')
    .trim();
  return text || null;
};

const callOpenAICompatible = async (provider, prompt, systemPrompt) => {
  const response = await axios.post(
    provider.url,
    {
      model: provider.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 150,
      temperature: 0.7,
    },
      {
        headers: {
          Authorization: `Bearer ${provider.key}`,
          'Content-Type': 'application/json',
        },
      timeout: 7000,
    }
  );

  const message = extractTextFromOpenAIResponse(response.data);
  if (!message) {
    throw new Error(`Empty AI response from ${provider.name}`);
  }
  return message;
};

const callGemini = async (provider, prompt, systemPrompt) => {
  const url = `${provider.url}?key=${encodeURIComponent(provider.key)}`;
  const response = await axios.post(
    url,
    {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 150,
      },
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 7000,
    }
  );

  const text = extractTextFromGeminiResponse(response.data);
  if (!text) {
    throw new Error(`Empty AI response from ${provider.name}`);
  }
  return text;
};

const readProviderChain = () => {
  const providers = [];

  // Backward compatibility: existing single provider variables
  if (process.env.AI_API_KEY) {
    providers.push({
      name: process.env.AI_PROVIDER || 'primary',
      type: 'openai-compatible',
      key: process.env.AI_API_KEY,
      url:
        process.env.AI_API_URL ||
        OPENAI_COMPATIBLE_DEFAULTS.groq.url,
      model:
        process.env.AI_MODEL ||
        OPENAI_COMPATIBLE_DEFAULTS.groq.model,
    });
  }

  const openAiCompatProviders = [
    { env: 'AI_GROQ_API_KEY', name: 'groq' },
    { env: 'AI_OPENROUTER_API_KEY', name: 'openrouter' },
    { env: 'AI_XAI_API_KEY', name: 'xai' },
    { env: 'AI_CEREBRAS_API_KEY', name: 'cerebras' },
    { env: 'AI_MISTRAL_API_KEY', name: 'mistral' },
  ];

  for (const p of openAiCompatProviders) {
    const key = process.env[p.env];
    if (!key) continue;
    providers.push({
      name: p.name,
      type: 'openai-compatible',
      key,
      url:
        process.env[`AI_${p.name.toUpperCase()}_API_URL`] ||
        OPENAI_COMPATIBLE_DEFAULTS[p.name].url,
      model:
        process.env[`AI_${p.name.toUpperCase()}_MODEL`] ||
        OPENAI_COMPATIBLE_DEFAULTS[p.name].model,
    });
  }

  if (process.env.AI_GEMINI_API_KEY) {
    const model = process.env.AI_GEMINI_MODEL || GEMINI_DEFAULTS.model;
    providers.push({
      name: 'gemini',
      type: 'gemini',
      key: process.env.AI_GEMINI_API_KEY,
      url:
        process.env.AI_GEMINI_API_URL ||
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      model,
    });
  }

  return providers;
};

const getAISuggestion = async (prompt, systemOverride) => {
  const systemPrompt = systemOverride || DEFAULT_SYSTEM_PROMPT;
  const providers = readProviderChain();

  if (providers.length === 0) {
    console.error(
      'AI providers are not configured. Add AI_API_KEY or provider-specific keys in .env.'
    );
    return null;
  }

  for (const provider of providers) {
    try {
      if (provider.type === 'gemini') {
        const text = await callGemini(provider, prompt, systemPrompt);
        return text;
      }

      const text = await callOpenAICompatible(provider, prompt, systemPrompt);
      return text;
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      const details = data?.error || data || err.message;
      console.error(
        `AI API error (${provider.name}):`,
        status || err.message,
        details
      );
      // Always continue to next configured provider until all are exhausted.
    }
  }

  try {
    console.error('All configured AI providers failed.');
    return null;
  } catch (_err) {
    return null;
  }
};

module.exports = { getAISuggestion };
