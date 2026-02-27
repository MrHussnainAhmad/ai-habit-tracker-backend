const axios = require('axios');

const getAISuggestion = async (prompt, systemOverride) => {
  try {
    const response = await axios.post(
      process.env.AI_API_URL,
      {
        model: process.env.AI_MODEL,
        messages: [
          {
            role: 'system',
            content:
              systemOverride ||
              'You are a habit-building coach. Give short, realistic, actionable advice. Be supportive, not generic motivational spam. Keep responses under 80 words.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 150,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.AI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    const message = response.data.choices?.[0]?.message?.content;
    if (!message) {
      throw new Error('Empty AI response');
    }

    return message.trim();
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    const details = data?.error || data || err.message;
    console.error('AI API error:', status || err.message, details);
    return null;
  }
};

module.exports = { getAISuggestion };
