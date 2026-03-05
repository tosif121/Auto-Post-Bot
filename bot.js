// ================================================================
//  X Post Generator → Notion CMS
//  Generates 24+ viral posts/hour across all categories
//  You pick & copy-paste the best ones to post manually
//  AI: OpenRouter (free models) | Storage: Notion Database
// ================================================================

'use strict';

require('dotenv').config();
const { Client } = require('@notionhq/client');
const Parser = require('rss-parser');
const fetch = require('node-fetch');

// ─── CONFIG ──────────────────────────────────────────────────────
const CONFIG = {
  NOTION_API_KEY: process.env.NOTION_API_KEY,
  NOTION_DATABASE_ID: process.env.NOTION_DATABASE_ID,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  AI_MODEL: 'openai/gpt-4o-mini',
  // How many posts to generate per category per run
  POSTS_PER_CATEGORY: 3,
};

// ─── CATEGORY SCHEDULE (weight = posts per run) ──────────────────
const CATEGORIES = [
  { category: 'tech', weight: 3, emoji: '💻' },
  { category: 'ai', weight: 3, emoji: '🤖' },
  { category: 'coding', weight: 3, emoji: '👨‍💻' },
];

// ─── RSS FEEDS ───────────────────────────────────────────────────
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
    'https://www.wired.com/feed/category/ai/latest/rss',
    'https://blogs.nvidia.com/feed/',
    'https://www.artificialintelligence-news.com/feed/',
    'https://www.technologyreview.com/topic/artificial-intelligence/feed/',
    'https://openai.com/blog/rss.xml',
  ],
  coding: ['https://dev.to/feed', 'https://www.freecodecamp.org/news/rss/', 'https://hackernoon.com/feed'],
};

// ─── AI PERSONAS ─────────────────────────────────────────────────
const PERSONAS = {
  tech: {
    voice: 'Sharp tech commentator followed by devs, founders, and techies',
    style: 'Insightful, opinionated, curious — sometimes snarky about Big Tech',
    hashtags: '#TechNews #TechTweeps #Startups #Innovation',
  },
  ai: {
    voice: 'AI researcher and enthusiast who stays on the absolute bleeding edge',
    style: 'Analytical, highlighting the future implications of AI models, excited',
    hashtags: '#AI #MachineLearning #GenerativeAI #ArtificialIntelligence',
  },
  coding: {
    voice: 'Senior Software Engineer sharing coding tips and dev news',
    style: 'Relatable to developers, technical, shares learning resources and dev moments',
    hashtags: '#Coding #100DaysOfCode #WebDev #SoftwareEngineering',
  },
};

// ─── CLIENTS ─────────────────────────────────────────────────────
const notion = new Client({ auth: CONFIG.NOTION_API_KEY });
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
  // Deduplicate by title
  const seen = new Set();
  return items
    .filter((item) => {
      if (seen.has(item.title)) return false;
      seen.add(item.title);
      return true;
    })
    .sort(() => Math.random() - 0.5);
}

// ─── GENERATE MULTIPLE TWEETS FOR ONE NEWS ITEM ──────────────────
async function generateTweets(item, count = 3) {
  const persona = PERSONAS[item.tag] || PERSONAS.world;
  const catInfo = CATEGORIES.find((c) => c.category === item.tag) || {};

  const prompt = `You are a ${persona.voice} on X (Twitter).
Style: ${persona.style}
Suggested hashtags: ${persona.hashtags}

Generate ${count} DIFFERENT viral X (Twitter) posts about this news.
Each post must:
- Be MAX 260 characters including hashtags
- Start with a different strong HOOK each time (shocking stat / bold opinion / punchy question / hot take)
- Sound like a real human — NOT a news bot
- Mentions today's date or day context naturally in the post.
- Include 2-3 relevant hashtags at the end
- Be ready to copy-paste directly

News headline: ${item.title}
Context: ${item.summary?.slice(0, 400) || ''}

Return ONLY a JSON array of ${count} tweet strings, no explanation:
["tweet 1 here", "tweet 2 here", "tweet 3 here"]`;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CONFIG.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://xbot.vercel.app',
        'X-Title': 'X Post Generator',
      },
      body: JSON.stringify({
        model: CONFIG.AI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.9,
      }),
    });

    if (!res.ok) {
      console.error('⚠️  OpenRouter error:', res.status, await res.text());
      return [];
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';

    // Parse JSON array from response
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) {
      console.error('⚠️  Failed to parse JSON from AI response:', content);
      return [];
    }

    const tweets = JSON.parse(match[0]);
    return tweets
      .filter((t) => typeof t === 'string' && t.length > 10 && t.length <= 280)
      .map((t) => t.replace(/^["'`]|["'`]$/g, '').trim());
  } catch (err) {
    console.error('⚠️  Fetch error in generateTweets:', err.message);
    return [];
  }
}

// ─── SAVE POST BATCH TO NOTION ────────────────────────────────────
async function saveToNotion(posts) {
  const saved = [];
  for (const post of posts) {
    try {
      const page = await notion.pages.create({
        parent: { database_id: CONFIG.NOTION_DATABASE_ID },
        properties: {
          // Title = the tweet text (easy to read & copy)
          Tweet: {
            title: [{ text: { content: post.tweet } }],
          },
          Category: {
            select: { name: post.category },
          },
          'Source Headline': {
            rich_text: [{ text: { content: post.headline.slice(0, 200) } }],
          },
          Characters: {
            number: post.tweet.length,
          },
          Status: {
            select: { name: '⏳ Review' },
          },
          Score: {
            select: { name: post.score },
          },
          'Generated At': {
            date: { start: new Date().toISOString() },
          },
        },
      });
      saved.push(page.id);
    } catch (err) {
      console.error('Notion save error:', err.message);
    }
    // Small delay to avoid Notion rate limits
    await new Promise((r) => setTimeout(r, 350));
  }
  return saved;
}

// ─── SCORE TWEET QUALITY ─────────────────────────────────────────
function scoreTweet(tweet) {
  let score = 0;
  // Has hashtags
  if (/#\w+/.test(tweet)) score += 2;
  // Good length (200-260 chars is sweet spot)
  if (tweet.length >= 180 && tweet.length <= 260) score += 2;
  // Has question mark (questions get engagement)
  if (tweet.includes('?')) score += 1;
  // Has numbers/stats
  if (/\d+/.test(tweet)) score += 1;
  // Has emoji
  if (/\p{Emoji}/u.test(tweet)) score += 1;
  // Not too short
  if (tweet.length < 80) score -= 2;

  if (score >= 5) return '🔥 High';
  if (score >= 3) return '✅ Good';
  return '📝 Average';
}

// ─── CLEAR OLD POSTS (OLDER THAN 7 DAYS) ─────────────────────────
async function cleanOldPosts() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const dateString = sevenDaysAgo.toISOString();

  console.log(`\n🧹 Cleaning up posts older than 7 days (before ${dateString})...`);

  try {
    const response = await notion.databases.query({
      database_id: CONFIG.NOTION_DATABASE_ID,
      filter: {
        timestamp: 'created_time',
        created_time: {
          before: dateString,
        },
      },
    });

    const pagesToDelete = response.results;
    if (pagesToDelete.length === 0) {
      console.log('  ✅ No old posts to clean up.');
      return 0;
    }

    console.log(`  🗑️  Found ${pagesToDelete.length} old posts. Archiving...`);

    let deletedCount = 0;
    for (const page of pagesToDelete) {
      await notion.pages.update({
        page_id: page.id,
        archived: true, // Notion "deletes" pages by archiving them
      });
      deletedCount++;
      // Sleep to avoid rate limits
      await new Promise((r) => setTimeout(r, 350));
    }

    console.log(`  ✅ Successfully removed ${deletedCount} old posts.`);
    return deletedCount;
  } catch (error) {
    console.error('  ❌ Error cleaning up old posts:', error.body || error.message);
    return 0;
  }
}

// ─── MAIN RUN ────────────────────────────────────────────────────
async function runBot() {
  const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  console.log(`\n${'═'.repeat(55)}`);
  console.log(`🤖 Generator run | ${time} IST`);
  console.log(`${'═'.repeat(55)}`);

  // 1. Clean up old posts first
  await cleanOldPosts();

  const allPosts = [];
  let totalFetch = 0;

  for (const { category, weight, emoji } of CATEGORIES) {
    const postsTarget = weight * CONFIG.POSTS_PER_CATEGORY;
    console.log(`\n${emoji} [${category.toUpperCase()}] — targeting ${postsTarget} posts`);

    const items = await fetchCategory(category);
    if (!items.length) {
      console.log(`  ⚠️  No RSS items found`);
      continue;
    }

    // Pick top N items based on weight
    const selectedItems = items.slice(0, weight * 2);
    let categoryPosts = 0;

    for (const item of selectedItems) {
      if (categoryPosts >= postsTarget) break;

      const tweetsNeeded = Math.min(3, postsTarget - categoryPosts);
      const tweets = await generateTweets(item, tweetsNeeded);

      for (const tweet of tweets) {
        if (categoryPosts >= postsTarget) break;
        allPosts.push({
          tweet,
          category,
          headline: item.title,
          score: scoreTweet(tweet),
        });
        categoryPosts++;
        totalFetch++;
      }

      // Avoid hitting OpenRouter rate limits
      await new Promise((r) => setTimeout(r, 1200));
    }

    console.log(`  ✅ Generated ${categoryPosts} posts`);
  }

  console.log(`\n📝 Saving ${allPosts.length} posts to Notion...`);
  const saved = await saveToNotion(allPosts);
  console.log(`✅ Saved ${saved.length} posts to Notion`);
  console.log(`\n📊 Run complete | ${allPosts.length} posts generated`);

  return { generated: allPosts.length, saved: saved.length };
}

module.exports = runBot;

if (require.main === module) {
  runBot().catch(console.error);
}
