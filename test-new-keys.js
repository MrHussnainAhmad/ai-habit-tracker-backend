require('dotenv').config();
const axios = require('axios');

const TEST_PROMPT = 'I want to start exercising daily. Give me one simple tip.';

const testZAPI = async () => {
  console.log(`\n🧪 Testing ZAPI...`);
  try {
    const response = await axios.post(
      'https://api.zapi.ai/v1/chat/completions',
      {
        model: 'zapi-default',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
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
    console.log(`   ✅ SUCCESS!`);
    return true;
  } catch (err) {
    const status = err.response?.status;
    const errMsg = err.response?.data?.error?.message || err.message;
    console.log(`   ❌ FAILED - Status: ${status}, Error: ${errMsg}`);
    return false;
  }
};

const testGitHub = async () => {
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
      return true;
    } else {
      console.log(`   ❌ Invalid response from GitHub`);
      return false;
    }
  } catch (err) {
    const status = err.response?.status;
    const errMsg = err.response?.data?.message || err.message;
    console.log(`   ❌ FAILED - Status: ${status}, Error: ${errMsg}`);
    return false;
  }
};

const runTests = async () => {
  console.log('🚀 TESTING NEW API KEYS\n');

  const results = {};

  if (process.env.ZAPI_KEY) {
    results['ZAPI'] = await testZAPI();
  } else {
    console.log('\n⚠️  ZAPI_KEY not found in .env');
  }

  if (process.env.GITHUB_API_KEY) {
    results['GitHub API'] = await testGitHub();
  } else {
    console.log('\n⚠️  GITHUB_API_KEY not found in .env');
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY\n');

  const working = Object.entries(results)
    .filter(([, status]) => status)
    .map(([name]) => name);
  const notWorking = Object.entries(results)
    .filter(([, status]) => !status)
    .map(([name]) => name);

  if (working.length > 0) {
    console.log('✅ WORKING:');
    working.forEach((name) => console.log(`   • ${name}`));
  }

  if (notWorking.length > 0) {
    console.log('\n❌ NOT WORKING:');
    notWorking.forEach((name) => console.log(`   • ${name}`));
  }

  console.log('\n' + '='.repeat(60) + '\n');

  return { working, notWorking };
};

runTests();
