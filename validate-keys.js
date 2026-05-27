require('dotenv').config();

console.log('🔍 API KEY VALIDATION\n');

console.log('ZAPI_KEY:', process.env.ZAPI_KEY ? '✓ Present' : '✗ Missing');
console.log('GITHUB_API_KEY:', process.env.GITHUB_API_KEY ? '✓ Present' : '✗ Missing');

console.log('\n📝 Analysis:');
console.log('- ZAPI_KEY format: Looks like a service API key (not standard LLM format)');
console.log('- GITHUB_API_KEY format: GitHub Personal Access Token (for GitHub API, not LLM)');
console.log('\nThese are NOT LLM providers. Recommend removing from .env.');
