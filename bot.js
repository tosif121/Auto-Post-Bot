// ================================================================
//  X (Twitter) Auto-Post Bot
//  Topics : World News · India · Cricket · Technology · Finance
//  AI     : Perplexity AI (Sonar model)
//  Stack  : Node.js · twitter-api-v2 · fetch · rss-parser
// ================================================================

import 'dotenv/config';
import { TwitterApi } from 'twitter-api-v2';
import Parser from 'rss-parser';
import cron from 'node-cron';

// ─── CONFIG ─────────────────────────────────────────────────────
const CONFIG = {
  X_API_KEY: process.env.X_API_KEY || 'YOUR_X_API_KEY',
  X_API_SECRET: process.env.X_API_SECRET || 'YOUR_X_API_SECRET',
  X_ACCESS_TOKEN: process.env.X_ACCESS_TOKEN || 'YOUR_X_ACCESS_TOKEN',
  X_ACCESS_SECRET: process.env.X_ACCESS_SECRET || 'YOUR_X_ACCESS_SECRET',
  PPLX_API_KEY: process.env.PPLX_API_KEY || 'YOUR_PPLX_API_KEY',
  POSTS_PER_RUN: 3,
  CRON_SCHEDULE: '0 */3 * * *', // every 3 hours = 8 posts/day
  DRY_RUN: process.env.DRY_RUN === 'true' || false,
};

// ─── RSS FEEDS ───────────────────────────────────────────────────
const FEEDS = {
  world: [
    { url: 'http://feeds.bbci.co.uk/news/world/rss.xml', tag: 'World' },
    { url: 'https://www.aljazeera.com/xml/rss/all.xml', tag: 'World' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', tag: 'Geopolitics' },
  ],
  india: [
    { url: 'https://feeds.feedburner.com/ndtvnews-top-stories', tag: 'India' },
    { url: 'https://timesofindia.indiatimes.com/rssfeeds/296589292.cms', tag: 'India' },
    { url: 'https://www.thehindu.com/news/feeder/default.rss', tag: 'India' },
    { url: 'https://economictimes.indiatimes.com/rssfeedsdefault.cms', tag: 'Economy' },
  ],
  cricket: [
    { url: 'https://www.cricbuzz.com/rss/cricket-news', tag: 'Cricket' },
    { url: 'https://www.espncricinfo.com/rss/content/story/feeds/0.xml', tag: 'Cricket' },
    { url: 'https://sports.ndtv.com/cricket/rss', tag: 'Cricket' },
  ],
  tech: [
    { url: 'https://techcrunch.com/feed/', tag: 'Technology' },
    { url: 'https://www.theverge.com/rss/index.xml', tag: 'Technology' },
    { url: 'https://feeds.feedburner.com/ndtvgadgets-latest', tag: 'Technology' },
  ],
  finance: [
    { url: 'https://economictimes.indiatimes.com/rssfeedsdefault.cms', tag: 'Economy' },
    { url: 'https://www.moneycontrol.com/rss/business.xml', tag: 'Economy' },
    { url: 'https://www.livemint.com/rss/markets', tag: 'Economy' },
  ],
};

// ─── CATEGORY WEIGHTS (posts per day) ────────────────────────────
const CATEGORY_SCHEDULE = [
  { category: 'cricket', weight: 4 },
  { category: 'tech', weight: 3 },
  { category: 'finance', weight: 2 },
  { category: 'india', weight: 2 },
  { category: 'world', weight: 1 },
];

// ─── AI PERSONAS ─────────────────────────────────────────────────
const PERSONAS = {
  Cricket: `You are a passionate Indian cricket fanatic and sports journalist on X.
Write punchy, emotionally charged cricket tweets. Use cricket terminology, player names, match context.
Hashtags: #Cricket #TeamIndia #IPL #INDvXXX #ViratKohli etc.`,

  Technology: `You are a slick, futurist tech commentator on X based in India.
Write high-engagement tweets about AI, startups, gadgets, Elon Musk, and exponential tech.
Give bold predictions. Sound like an insider shaping the future.
Hashtags: #Tech #AI #Startups #Innovation`,

  Economy: `You are a sharp finance and crypto commentator on X based in India.
Write engaging tweets on markets, Indian economy, startups, and making money.
Use data points. Sound like a wealthy, smart investor.
Hashtags: #Economy #StockMarket #India #Business`,

  India: `You are a sharp, opinionated Indian news commentator on X.
Write insightful tweets on Indian politics, economy, and social issues.
Sound like an educated Indian citizen with a strong take.`,

  World: `You are a globally aware geopolitical commentator on X based in India.
Write sharp takes on world events, wars, diplomacy with an Indian angle when relevant.`,

  Geopolitics: `You are a geopolitics analyst on X. Bold, factual, engaging takes on global power dynamics.`,
};

// ─── CLIENTS ─────────────────────────────────────────────────────
const twitter = new TwitterApi({
  appKey: CONFIG.X_API_KEY,
  appSecret: CONFIG.X_API_SECRET,
  accessToken: CONFIG.X_ACCESS_TOKEN,
  accessSecret: CONFIG.X_ACCESS_SECRET,
});

const parser = new Parser({ timeout: 8000 });
const postedTitles = new Set();

// ─── FETCH FEEDS ─────────────────────────────────────────────────
async function fetchFeed(feedConfig) {
  try {
    const feed = await parser.parseURL(feedConfig.url);
    return feed.items.slice(0, 6).map((item) => ({
      title: item.title?.trim() || '',
      summary: item.contentSnippet?.trim() || '',
      link: item.link || '',
      tag: feedConfig.tag,
    }));
  } catch {
    return [];
  }
}

async function fetchCategory(categoryName) {
  const feedList = FEEDS[categoryName] || [];
  const results = await Promise.allSettled(feedList.map(fetchFeed));
  return results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value)
    .filter((item) => item.title && !postedTitles.has(item.title))
    .sort(() => Math.random() - 0.5);
}

// ─── PERPLEXITY TWEET GENERATOR ───────────────────────────────────────
async function generateTweet(item) {
  const persona = PERSONAS[item.tag] || PERSONAS['World'];
  const label =
    {
      Cricket: '🏏 CRICKET',
      Technology: '🤖 TECHNOLOGY',
      India: '🇮🇳 INDIA',
      World: '🌍 WORLD',
      Geopolitics: '🌍 GEOPOLITICS',
      Economy: '📈 ECONOMY',
    }[item.tag] || '📰 NEWS';

  const prompt = `Convert this into ONE viral X (Twitter) post.

STRICT RULES:
- MAX 260 characters including hashtags
- Start with a strong HOOK: shocking fact, bold opinion, or intriguing question
- Add 1 sentence of your own take
- End with 2-3 hashtags
- Write like a smart opinionated human — NOT a news bot
- Return ONLY the tweet text, nothing else

${label}:
Title: ${item.title}
Context: ${item.summary?.slice(0, 300) || ''}`;

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CONFIG.PPLX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: persona },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Perplexity API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    let tweet = data.choices[0].message.content.trim();
    tweet = tweet.replace(/^["'`]|["'`]$/g, '').trim();
    return tweet.length > 0 && tweet.length <= 280 ? tweet : null;
  } catch (err) {
    console.error(`❌ Perplexity error [${item.tag}]:`, err.message);
    return null;
  }
}

// ─── POST TO X ───────────────────────────────────────────────────
async function postTweet(text) {
  if (CONFIG.DRY_RUN) {
    console.log(`\n🧪 DRY RUN [${text.length}ch]: ${text}`);
    return;
  }
  return await twitter.v2.tweet(text);
}

// ─── PICK CATEGORIES FOR THIS RUN ────────────────────────────────
function pickCategoriesForRun(count) {
  const pool = CATEGORY_SCHEDULE.flatMap(({ category, weight }) => Array(weight).fill(category)).sort(
    () => Math.random() - 0.5,
  );
  return [...new Set(pool)].slice(0, count);
}

// ─── MAIN RUN ────────────────────────────────────────────────────
async function runBot() {
  const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  console.log(`\n${'─'.repeat(55)}`);
  console.log(`🤖 Bot run — ${time} IST`);

  const categories = pickCategoriesForRun(CONFIG.POSTS_PER_RUN);
  console.log(`📋 Queue: ${categories.join(' · ')}`);

  let posted = 0;
  for (const category of categories) {
    const items = await fetchCategory(category);
    const item = items[0];
    if (!item) {
      console.log(`⚠️  No items for [${category}]`);
      continue;
    }

    const tweet = await generateTweet(item);
    if (!tweet) {
      console.log(`⚠️  Gen failed for [${category}]`);
      continue;
    }

    try {
      await postTweet(tweet);
      postedTitles.add(item.title);
      posted++;
      console.log(`✅ [${item.tag}] (${tweet.length}ch): ${tweet}`);
      if (posted < categories.length) await new Promise((r) => setTimeout(r, 45_000));
    } catch (err) {
      if (err.message?.includes('duplicate')) {
        postedTitles.add(item.title);
        console.log(`⚠️  Duplicate skipped [${category}]`);
      } else {
        console.error(`❌ Failed [${category}]: ${err.message}`);
      }
    }
  }
  console.log(`📊 Done: ${posted}/${categories.length} posted`);
}

// ─── START ───────────────────────────────────────────────────────
console.log(`
╔══════════════════════════════════════════╗
║   🚀  X Bot — Perplexity AI Edition      ║
║   Cricket · Tech · Finance               ║
║   India · World · Economy               ║
║   Posts ~8/day  |  DRY_RUN: ${CONFIG.DRY_RUN}        ║
╚══════════════════════════════════════════╝
`);

runBot();
cron.schedule(CONFIG.CRON_SCHEDULE, runBot);
