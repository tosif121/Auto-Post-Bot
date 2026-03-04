// api/bot.js — Vercel serverless handler
// Called every hour by Vercel cron

const runBot = require('../bot');

module.exports = async (req, res) => {
  // Protect endpoint with a secret
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers['x-cron-secret'] || req.query.secret;
    if (auth !== secret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const result = await runBot();
    res.status(200).json({ status: 'ok', ...result });
  } catch (err) {
    console.error('Bot failed:', err);
    res.status(500).json({ status: 'failed', error: err.message });
  }
};
