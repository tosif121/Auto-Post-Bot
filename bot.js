// ================================================================
//  X Post Generator — VIRAL MACHINE 🔥
//  Generates viral posts across ALL trending niches
//  Goal: 5M+ impressions/month
//  AI: OpenRouter | UI: Express + EJS
// ================================================================

'use strict';

require('dotenv').config();
const fetch = require('node-fetch');
const Parser = require('rss-parser');

// ─── CONFIG ──────────────────────────────────────────────────────
const CONFIG = {
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  AI_MODEL: 'openai/gpt-4o-mini',
  POSTS_PER_CATEGORY: 3,
};

// ─── ALL VIRAL NICHES ────────────────────────────────────────────
const CATEGORIES = [
  { category: 'tech', weight: 2, emoji: '💻' },
  { category: 'ai', weight: 2, emoji: '🤖' },
  { category: 'coding', weight: 2, emoji: '👨‍💻' },
  { category: 'crypto', weight: 2, emoji: '₿' },
  { category: 'business', weight: 2, emoji: '💰' },
  { category: 'motivation', weight: 2, emoji: '🔥' },
  { category: 'entertainment', weight: 2, emoji: '🎬' },
  { category: 'sports', weight: 2, emoji: '⚽' },
  { category: 'science', weight: 2, emoji: '🔬' },
  { category: 'world', weight: 2, emoji: '🌍' },
  { category: 'health', weight: 2, emoji: '💪' },
  { category: 'gaming', weight: 2, emoji: '🎮' },
];

// ─── RSS FEEDS (Many sources per niche) ──────────────────────────
const FEEDS = {
  tech: [
    'https://feeds.feedburner.com/Techcrunch',
    'https://www.theverge.com/rss/index.xml',
    'https://thenextweb.com/feed/',
    'https://feeds.arstechnica.com/arstechnica/index',
    'https://feeds.feedburner.com/venturebeat/SZYF',
  ],
  ai: [
    'https://techcrunch.com/category/artificial-intelligence/feed/',
    'https://www.artificialintelligence-news.com/feed/',
    'https://blogs.nvidia.com/feed/',
    'https://openai.com/blog/rss.xml',
  ],
  coding: ['https://dev.to/feed', 'https://www.freecodecamp.org/news/rss/', 'https://hackernoon.com/feed'],
  crypto: [
    'https://cointelegraph.com/rss',
    'https://coindesk.com/arc/outboundfeeds/rss/',
    'https://decrypt.co/feed',
    'https://bitcoinmagazine.com/feed',
  ],
  business: [
    'https://feeds.feedburner.com/entrepreneur/latest',
    'https://www.inc.com/rss/',
    'https://fortune.com/feed/',
    'https://feeds.feedburner.com/fastcompany/headlines',
  ],
  motivation: ['https://www.success.com/feed/', 'https://addicted2success.com/feed/', 'https://www.lifehack.org/feed'],
  entertainment: [
    'https://variety.com/feed/',
    'https://deadline.com/feed/',
    'https://www.hollywoodreporter.com/feed/',
    'https://ew.com/feed/',
  ],
  sports: [
    'https://www.espn.com/espn/rss/news',
    'https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml',
    'https://feeds.bbci.co.uk/sport/rss.xml',
  ],
  science: [
    'https://www.sciencedaily.com/rss/all.xml',
    'https://feeds.nature.com/nature/rss/current',
    'https://www.newscientist.com/feed/home/',
    'https://phys.org/rss-feed/',
  ],
  world: [
    'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    'https://feeds.bbci.co.uk/news/world/rss.xml',
    'https://www.aljazeera.com/xml/rss/all.xml',
    'https://feeds.reuters.com/reuters/topNews',
  ],
  health: [
    'https://www.medicalnewstoday.com/newsrss',
    'https://rss.nytimes.com/services/xml/rss/nyt/Health.xml',
    'https://www.health.com/feed/',
  ],
  gaming: [
    'https://www.ign.com/articles/feed',
    'https://www.gamespot.com/feeds/mashup/',
    'https://kotaku.com/rss',
    'https://www.polygon.com/rss/index.xml',
  ],
};

// ─── VIRAL AI PERSONAS ───────────────────────────────────────────
const PERSONAS = {
  tech: {
    voice: 'Sharp tech insider with 500K followers who drops hot takes',
    style: 'Punchy, opinionated, contrarian — makes devs and founders rage-engage',
    hashtags: '#Tech #Innovation #Startups',
  },
  ai: {
    voice: 'AI hype-man who makes complex AI feel mind-blowing to everyone',
    style: 'Mind-blown energy, future-is-now vibes, makes normies care about AI',
    hashtags: '#AI #ChatGPT #ArtificialIntelligence',
  },
  coding: {
    voice: 'Relatable dev who makes coding culture go viral',
    style: 'Memes-in-text-form, dev humor, hot takes on frameworks and languages',
    hashtags: '#Coding #WebDev #Programming',
  },
  crypto: {
    voice: 'Crypto analyst who calls it like it is — bullish AND bearish',
    style: 'Numbers-driven, breaking-news energy, FOMO-inducing but honest',
    hashtags: '#Bitcoin #Crypto #Web3',
  },
  business: {
    voice: 'Entrepreneur sharing billion-dollar lessons in one tweet',
    style: 'Story-driven, "here\'s what they don\'t tell you" energy, contrarian takes',
    hashtags: '#Business #Entrepreneur #Money',
  },
  motivation: {
    voice: 'No-BS motivator — not cheesy, just raw real talk',
    style: 'Hard truths, mindset shifts, "read that again" energy, punchy one-liners',
    hashtags: '#Motivation #Mindset #Success',
  },
  entertainment: {
    voice: 'Pop culture commentator everyone follows for hot takes',
    style: 'Spicy opinions on movies/shows/celebs, "am I wrong?" energy',
    hashtags: '#Entertainment #Movies #PopCulture',
  },
  sports: {
    voice: 'Sports analyst who drops takes that start wars in the replies',
    style: 'Bold predictions, hot takes, "you can\'t change my mind" energy',
    hashtags: '#Sports #NFL #NBA',
  },
  science: {
    voice: 'Science communicator who makes nerdy stuff feel mind-blowing',
    style: "Holy-sh*t-I-didn't-know-that energy, makes people share instantly",
    hashtags: '#Science #Space #Facts',
  },
  world: {
    voice: 'Breaking news commentator with smart, viral analysis',
    style: 'First-to-know energy, geopolitical hot takes, "this changes everything"',
    hashtags: '#WorldNews #Breaking #Geopolitics',
  },
  health: {
    voice: 'Health truth-teller debunking myths and dropping knowledge',
    style: 'Contrarian health takes, backed by science, relatable wellness tips',
    hashtags: '#Health #Wellness #Fitness',
  },
  gaming: {
    voice: 'Gaming culture insider with spicy opinions on every franchise',
    style: 'Hot takes on releases, nostalgia bait, "unpopular opinion" energy',
    hashtags: '#Gaming #Gamer #PlayStation #Xbox',
  },
};

// ─── RSS PARSER ──────────────────────────────────────────────────
const rssParser = new Parser({ timeout: 8000 });

// ─── FETCH ONE FEED ──────────────────────────────────────────────
async function fetchFeed(url, tag) {
  try {
    const feed = await rssParser.parseURL(url);
    return feed.items.slice(0, 8).map((item) => ({
      title: item.title?.trim() || '',
      summary: item.contentSnippet?.trim() || item.summary?.trim() || '',
      link: item.link || '',
      tag,
    }));
  } catch {
    return [];
  }
}

// ─── FETCH ALL ITEMS FOR A CATEGORY ──────────────────────────────
async function fetchCategory(categoryName) {
  const urls = FEEDS[categoryName] || [];
  const results = await Promise.allSettled(urls.map((url) => fetchFeed(url, categoryName)));
  const items = results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value)
    .filter((item) => item.title);
  const seen = new Set();
  return items
    .filter((item) => {
      if (seen.has(item.title)) return false;
      seen.add(item.title);
      return true;
    })
    .sort(() => Math.random() - 0.5);
}

// ─── GENERATE SHORT VIRAL TWEETS (Classic 280 char) ──────────────
async function generateShortTweets(item, count = 2) {
  const persona = PERSONAS[item.tag] || PERSONAS.tech;

  const prompt = `You are a ${persona.voice} on X (Twitter) with a massive following.
Style: ${persona.style}
Suggested hashtags: ${persona.hashtags}

Your ONLY goal: make posts that get MAXIMUM engagement (likes, retweets, replies, bookmarks).

Generate ${count} DIFFERENT short viral X posts about this news.

VIRAL FORMULAS TO USE (pick different ones):
• "Hot take: [bold opinion]" → triggers replies
• "Nobody's talking about [thing]" → curiosity gap
• Start with a shocking stat or number
• "Unpopular opinion:" → triggers debate  
• "Let that sink in." as closer → shareable
• Ask a provocative question → gets replies
• "[Thing] is dead. Here's why:" → contrarian
• Use "you" to make it personal
• End with "Agree or disagree?" or "Am I wrong?"

Each post MUST:
- Be MAX 260 characters including hashtags
- Have a STRONG hook in the first 5 words (people scroll fast!)
- Sound like a REAL person with a strong opinion — NOT a news bot
- Create an emotional reaction (shock, curiosity, FOMO, debate)
- Include 2-3 relevant hashtags
- Be designed to make someone STOP scrolling and engage

News headline: ${item.title}
Context: ${item.summary?.slice(0, 400) || ''}

Return ONLY a JSON array of ${count} tweet strings:
["tweet 1", "tweet 2"]`;

  return await callAI(prompt, count, 600, 280);
}

// ─── GENERATE LONG-FORM PREMIUM POSTS (X Premium: up to 4000) ───
async function generateLongPosts(item, count = 1) {
  const persona = PERSONAS[item.tag] || PERSONAS.tech;

  const prompt = `You are a ${persona.voice} on X (Twitter) with X Premium (long posts up to 4000 chars).
Style: ${persona.style}
Suggested hashtags: ${persona.hashtags}

Generate ${count} LONG-FORM X Premium post(s) about this news.
These are the posts that go MEGA viral because they deliver VALUE.

FORMAT RULES FOR LONG POSTS:
- Use 800-2000 characters (use the space! short = wasted Premium)
- Start with a SHORT punchy hook (1 line that makes people click "Show more")
- Use line breaks (\\n\\n) between paragraphs for readability
- Use bullet points with emojis (• 🔹 ▸) for lists
- Use CAPS for 1-2 key words per paragraph for emphasis
- End with a strong CTA: "Repost if you agree" / "Bookmark this" / "Follow for more"
- Include 3-5 hashtags at the very end
- Sound like a REAL human sharing a valuable take — NOT a news article

LONG POST VIRAL FORMULAS:
• "Here's what nobody is telling you about [topic]:" → thread-in-one-post
• "I spent [time] researching [topic]. Here's what I found:" → value post
• "[Number] things about [topic] that will blow your mind:" → listicle post
• "The real story behind [headline] (most people missed this):" → insider take
• "Everyone is talking about [topic]. But here's the part they're ignoring:" → contrarian deep dive

THE FIRST LINE IS EVERYTHING. On X, long posts show only the first ~280 chars before "Show more". That first line MUST be a scroll-stopping hook.

News headline: ${item.title}
Context: ${item.summary?.slice(0, 600) || ''}

Return ONLY a JSON array of ${count} post strings. Use \\n for line breaks inside the strings:
["long post 1 here"]`;

  return await callAI(prompt, count, 2000, 4000);
}

// ─── AI CALL HELPER ──────────────────────────────────────────────
async function callAI(prompt, count, maxTokens, maxLength) {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CONFIG.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://xbot.local',
        'X-Title': 'X Post Generator',
      },
      body: JSON.stringify({
        model: CONFIG.AI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.95,
      }),
    });

    if (!res.ok) {
      console.error('⚠️  OpenRouter error:', res.status, await res.text());
      return [];
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';

    const match = content.match(/\[[\s\S]*\]/);
    if (!match) {
      console.error('⚠️  Failed to parse JSON from AI response:', content);
      return [];
    }

    const posts = JSON.parse(match[0]);
    return posts
      .filter((t) => typeof t === 'string' && t.length > 10 && t.length <= maxLength)
      .map((t) => t.replace(/^["'`]|["'`]$/g, '').trim());
  } catch (err) {
    console.error('⚠️  Fetch error:', err.message);
    return [];
  }
}

// ─── SCORE POST VIRALITY ─────────────────────────────────────────
function scoreTweet(tweet) {
  let score = 0;
  if (/#\w+/.test(tweet)) score += 2;
  // Short tweet sweet spot
  if (tweet.length >= 180 && tweet.length <= 280) score += 2;
  // Long-form premium bonus (these get massive reach)
  if (tweet.length > 500) score += 3;
  if (tweet.length > 1000) score += 2;
  if (tweet.includes('?')) score += 2; // Questions = replies
  if (/\d+/.test(tweet)) score += 1; // Stats = credibility
  if (/\p{Emoji}/u.test(tweet)) score += 1;
  if (tweet.length < 80) score -= 2;
  // Line breaks = formatted = more engaging
  if (tweet.includes('\n')) score += 1;
  // Viral hooks bonus
  const viralHooks = [
    'unpopular opinion',
    'nobody',
    'hot take',
    'let that sink in',
    'agree or disagree',
    'am i wrong',
    "here's why",
    'thread',
    'breaking',
    'bookmark this',
    'repost',
    'follow for more',
  ];
  for (const hook of viralHooks) {
    if (tweet.toLowerCase().includes(hook)) {
      score += 2;
      break;
    }
  }

  if (score >= 6) return '🔥 Viral';
  if (score >= 4) return '✅ Strong';
  return '📝 Decent';
}

// ─── MAIN RUN ────────────────────────────────────────────────────
async function runBot() {
  const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  console.log(`\n${'═'.repeat(55)}`);
  console.log(`🤖 VIRAL MACHINE | ${time} IST`);
  console.log(`${'═'.repeat(55)}`);

  const allPosts = [];

  for (const { category, weight, emoji } of CATEGORIES) {
    const postsTarget = weight * CONFIG.POSTS_PER_CATEGORY;
    console.log(`\n${emoji} [${category.toUpperCase()}] — targeting ${postsTarget} posts`);

    const items = await fetchCategory(category);
    if (!items.length) {
      console.log(`  ⚠️  No RSS items found`);
      continue;
    }

    const selectedItems = items.slice(0, weight * 2);
    let categoryPosts = 0;

    for (const item of selectedItems) {
      if (categoryPosts >= postsTarget) break;

      // Generate short tweets (classic 280 char)
      const shortCount = Math.min(2, postsTarget - categoryPosts);
      const shortTweets = await generateShortTweets(item, shortCount);

      for (const tweet of shortTweets) {
        if (categoryPosts >= postsTarget) break;
        allPosts.push({
          tweet,
          category,
          type: 'short',
          headline: item.title,
          score: scoreTweet(tweet),
          charCount: tweet.length,
          generatedAt: new Date().toISOString(),
        });
        categoryPosts++;
      }

      // Generate 1 long-form premium post per item
      if (categoryPosts < postsTarget) {
        const longPosts = await generateLongPosts(item, 1);
        for (const tweet of longPosts) {
          if (categoryPosts >= postsTarget) break;
          allPosts.push({
            tweet,
            category,
            type: 'premium',
            headline: item.title,
            score: scoreTweet(tweet),
            charCount: tweet.length,
            generatedAt: new Date().toISOString(),
          });
          categoryPosts++;
        }
      }

      await new Promise((r) => setTimeout(r, 1200));
    }

    console.log(`  ✅ Generated ${categoryPosts} posts`);
  }

  console.log(`\n📊 Run complete | ${allPosts.length} posts generated across ${CATEGORIES.length} niches`);
  return allPosts;
}

module.exports = runBot;
