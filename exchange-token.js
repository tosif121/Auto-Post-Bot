require('dotenv').config();

async function exchangeToken(code) {
  if (!code) {
    console.error('❌ Please provide the authorization code as an argument.');
    console.log('Usage: node exchange-token.js YOUR_OAUTH_CODE');
    process.exit(1);
  }

  const clientId = process.env.NOTION_OAUTH_CLIENT_ID;
  const clientSecret = process.env.NOTION_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.NOTION_OAUTH_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.error('❌ Missing Notion OAuth credentials in .env file.');
    process.exit(1);
  }

  // Notion API requires Basic Auth for OAuth token exchange
  const encodedCredentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    console.log('🔄 Exchanging authorization code for an access token...');

    // Using dynamic import for node-fetch to support both CommonJS and ES Modules depending on the local setup
    const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

    const response = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${encodedCredentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Failed to exchange token:');
      console.error(data);
      process.exit(1);
    }

    console.log('\n✅ Successfully authenticated with Notion!');
    console.log('\n─────────────────────────────────────────────────');
    console.log('YOUR NOTION ACCESS TOKEN:');
    console.log(data.access_token);
    console.log('─────────────────────────────────────────────────\n');
    console.log('👉 Next Steps:');
    console.log(`1. Copy the access token above (it should start with 'ntn_...').`);
    console.log(`2. Paste it into your .env file as NOTION_API_KEY=\n`);
  } catch (error) {
    console.error('❌ Error during fetch:', error.message);
  }
}

// Get the code from the command line arguments
const authCode = process.argv[2];
exchangeToken(authCode);
