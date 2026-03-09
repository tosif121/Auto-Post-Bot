// ================================================================
//  X Post Generator — Local Server
//  Run: node server.js   →   Open: http://localhost:3000
// ================================================================

'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');
const runBot = require('./bot');

const app = express();
const PORT = process.env.PORT || 3000;

// EJS setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// In-memory store for generated posts
let generatedPosts = [];
let lastRunTime = null;
let isGenerating = false;

// ─── Helper: escape tweet for HTML attribute ────────────────────
function escapeForAttr(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, ' ')
    .replace(/\r/g, '');
}

// ─── HOME PAGE ───────────────────────────────────────────────────
app.get('/', (req, res) => {
  // Pre-escape tweets for safe HTML attribute embedding
  const postsWithEscaped = generatedPosts.map((p) => ({
    ...p,
    tweetEscaped: escapeForAttr(p.tweet),
  }));

  res.render('index', {
    posts: postsWithEscaped,
    lastRunTime,
    isGenerating,
  });
});

// ─── GENERATE (trigger bot) ─────────────────────────────────────
app.get('/generate', async (req, res) => {
  if (isGenerating) {
    return res.redirect('/');
  }

  isGenerating = true;
  try {
    const posts = await runBot();
    generatedPosts = posts;
    lastRunTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  } catch (err) {
    console.error('Bot run failed:', err);
  } finally {
    isGenerating = false;
  }

  res.redirect('/');
});

// ─── START SERVER ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 X Post Generator running at http://localhost:${PORT}`);
  console.log(`   Click "Generate Posts" in the browser to start!\n`);
});
