require('dotenv').config();
const axios = require('axios');

const DEFAULT_SYSTEM_PROMPT =
  'You are a habit-building coach. Give short, realistic, actionable advice. Be supportive, not generic motivational spam. Keep responses under 80 words.';

const TEST_PROMPT = 'I want to start exercising daily. Give me one simple tip.';

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

const testOpenAICompatible = async (provider) => {
  try {
    console.log(`\n🧪 Testing ${provider.name.toUpperCase()}...`);
    console.log(`   URL: ${provider.url}`);
    console.log(`   Model: ${provider.model}`);

    const response = await axios.post(
      provider.url,
      {
        model: provider.model,
        messages: [
          { role: 'system', content: DEFAULT_SYSTEM_PROMPT },
          { role: 'user', content: TEST_PROMPT },
        ],
        max_tokens: 150,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${provider.key}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    const message = extractTextFromOpenAIResponse(response.data);
    if (!message) {
      console.log(`   ❌ Empty response from ${provider.name}`);
      return false;
    }
    console.log(`   ✅ SUCCESS! Response: "${message.substring(0, 100)}..."`);
    return true;
  } catch (err) {
    const status = err.response?.status;
    const errMsg = err.response?.data?.error?.message || err.message;
    console.log(`   ❌ FAILED - Status: ${status}, Error: ${errMsg}`);
    return false;
  }
};

const testGemini = async (provider) => {
  try {
    console.log(`\n🧪 Testing GEMINI...`);
    console.log(`   Model: ${provider.model}`);

    const url = `${provider.url}?key=${encodeURIComponent(provider.key)}`;
    const response = await axios.post(
      url,
      {
        systemInstruction: {
          parts: [{ text: DEFAULT_SYSTEM_PROMPT }],
        },
        contents: [{ parts: [{ text: TEST_PROMPT }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 150,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    const text = extractTextFromGeminiResponse(response.data);
    if (!text) {
      console.log(`   ❌ Empty response from Gemini`);
      return false;
    }
    console.log(`   ✅ SUCCESS! Response: "${text.substring(0, 100)}..."`);
    return true;
  } catch (err) {
    const status = err.response?.status;
    const errMsg = err.response?.data?.error?.message || err.message;
    console.log(`   ❌ FAILED - Status: ${status}, Error: ${errMsg}`);
    return false;
  }
};

const runAllTests = async () => {
  console.log('🚀 AI API KEY TESTING SUITE\n');
  console.log(`Testing with prompt: "${TEST_PROMPT}"\n`);

  const results = {};

  // Test Primary Groq (backward compatibility)
  if (process.env.AI_API_KEY) {
    results['Primary (Groq)'] = await testOpenAICompatible({
      name: 'primary',
      key: process.env.AI_API_KEY,
      url: process.env.AI_API_URL || OPENAI_COMPATIBLE_DEFAULTS.groq.url,
      model: process.env.AI_MODEL || OPENAI_COMPATIBLE_DEFAULTS.groq.model,
    });
  }

  // Test Groq
  if (process.env.AI_GROQ_API_KEY) {
    results['Groq'] = await testOpenAICompatible({
      name: 'groq',
      key: process.env.AI_GROQ_API_KEY,
      url: OPENAI_COMPATIBLE_DEFAULTS.groq.url,
      model: OPENAI_COMPATIBLE_DEFAULTS.groq.model,
    });
  }

  // Test OpenRouter
  if (process.env.AI_OPENROUTER_API_KEY) {
    results['OpenRouter'] = await testOpenAICompatible({
      name: 'openrouter',
      key: process.env.AI_OPENROUTER_API_KEY,
      url: OPENAI_COMPATIBLE_DEFAULTS.openrouter.url,
      model: OPENAI_COMPATIBLE_DEFAULTS.openrouter.model,
    });
  }

  // Test xAI
  if (process.env.AI_XAI_API_KEY) {
    results['xAI'] = await testOpenAICompatible({
      name: 'xai',
      key: process.env.AI_XAI_API_KEY,
      url: OPENAI_COMPATIBLE_DEFAULTS.xai.url,
      model: OPENAI_COMPATIBLE_DEFAULTS.xai.model,
    });
  }

  // Test Cerebras
  if (process.env.AI_CEREBRAS_API_KEY) {
    results['Cerebras'] = await testOpenAICompatible({
      name: 'cerebras',
      key: process.env.AI_CEREBRAS_API_KEY,
      url: OPENAI_COMPATIBLE_DEFAULTS.cerebras.url,
      model: OPENAI_COMPATIBLE_DEFAULTS.cerebras.model,
    });
  }

  // Test Mistral
  if (process.env.AI_MISTRAL_API_KEY) {
    results['Mistral'] = await testOpenAICompatible({
      name: 'mistral',
      key: process.env.AI_MISTRAL_API_KEY,
      url: OPENAI_COMPATIBLE_DEFAULTS.mistral.url,
      model: OPENAI_COMPATIBLE_DEFAULTS.mistral.model,
    });
  }

  // Test TokenLLM7
  if (process.env.TokenLLM7_API_KEY) {
    results['TokenLLM7'] = await testOpenAICompatible({
      name: 'tokenllm7',
      key: process.env.TokenLLM7_API_KEY,
      url: 'https://api.tokenllm7.com/v1/chat/completions',
      model: 'tokenllm7-pro',
    });
  }

  // Test DeepSeek
  if (process.env.Deepseek_API_KY) {
    results['DeepSeek'] = await testOpenAICompatible({
      name: 'deepseek',
      key: process.env.Deepseek_API_KY,
      url: 'https://api.deepseek.com/v1/chat/completions',
      model: 'deepseek-chat',
    });
  }

  // Test ZAPI (ZebraAI or similar)
  if (process.env.ZAPI_KEY) {
    console.log(`\n🧪 Testing ZAPI...`);
    try {
      const response = await axios.post(
        'https://api.zapi.ai/v1/chat/completions',
        {
          model: 'zapi-default',
          messages: [
            { role: 'system', content: DEFAULT_SYSTEM_PROMPT },
            { role: 'user', content: TEST_PROMPT },
          ],
          max_tokens: 150,
          temperature: 0.7,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.ZAPI_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );
      const message = extractTextFromOpenAIResponse(response.data);
      if (!message) {
        console.log(`   ❌ Empty response from ZAPI`);
        results['ZAPI'] = false;
      } else {
        console.log(`   ✅ SUCCESS! Response: "${message.substring(0, 100)}..."`);
        results['ZAPI'] = true;
      }
    } catch (err) {
      const status = err.response?.status;
      const errMsg = err.response?.data?.error?.message || err.message;
      console.log(`   ❌ FAILED - Status: ${status}, Error: ${errMsg}`);
      results['ZAPI'] = false;
    }
  }

  // Test GitHub API
  if (process.env.GITHUB_API_KEY) {
    console.log(`\n🧪 Testing GITHUB_API_KEY...`);
    try {
      const response = await axios.get(
        'https://api.github.com/user',
        {
          headers: {
            Authorization: `token ${process.env.GITHUB_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );
      if (response.data && response.data.login) {
        console.log(`   ✅ SUCCESS! Authenticated as: ${response.data.login}`);
        results['GitHub API'] = true;
      } else {
        console.log(`   ❌ Invalid response from GitHub`);
        results['GitHub API'] = false;
      }
    } catch (err) {
      const status = err.response?.status;
      const errMsg = err.response?.data?.message || err.message;
      console.log(`   ❌ FAILED - Status: ${status}, Error: ${errMsg}`);
      results['GitHub API'] = false;
    }
  }

  // Print Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY\n');

  const working = Object.entries(results)
    .filter(([, status]) => status)
    .map(([name]) => name);
  const notWorking = Object.entries(results)
    .filter(([, status]) => !status)
    .map(([name]) => name);

  if (working.length > 0) {
    console.log('✅ WORKING PROVIDERS:');
    working.forEach((name) => console.log(`   • ${name}`));
  }

  if (notWorking.length > 0) {
    console.log('\n❌ NOT WORKING PROVIDERS:');
    notWorking.forEach((name) => console.log(`   • ${name}`));
  }

  console.log('\n' + '='.repeat(60));
  console.log(
    `\n✨ Result: ${working.length}/${Object.keys(results).length} providers working\n`
  );
};

runAllTests();
