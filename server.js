// ================================================================
//  X Post Generator — Local Server
//  Run: npm run dev   →   Open: http://localhost:3000
// ================================================================

'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');
const { runBot, CATEGORIES } = require('./bot');

const app = express();
const PORT = process.env.PORT || 3000;

// EJS setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files & form parsing
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// In-memory store
let generatedPosts = [];
let lastRunTime = null;
let isGenerating = false;
let lastSelectedNiches = [];

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
  const postsWithEscaped = generatedPosts.map((p) => ({
    ...p,
    tweetEscaped: escapeForAttr(p.tweet),
  }));

  res.render('index', {
    posts: postsWithEscaped,
    categories: CATEGORIES,
    lastRunTime,
    isGenerating,
    lastSelectedNiches,
  });
});

// ─── GENERATE (POST with niche selection) ────────────────────────
app.post('/generate', async (req, res) => {
  if (isGenerating) {
    return res.redirect('/');
  }

  // Get selected niches from form (checkboxes)
  let selectedNiches = req.body.niches || [];
  if (typeof selectedNiches === 'string') selectedNiches = [selectedNiches];
  lastSelectedNiches = selectedNiches;

  isGenerating = true;
  try {
    const posts = await runBot(selectedNiches);
    // Append to existing posts (don't overwrite)
    generatedPosts = [...posts, ...generatedPosts];
    lastRunTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  } catch (err) {
    console.error('Bot run failed:', err);
  } finally {
    isGenerating = false;
  }

  res.redirect('/');
});

// ─── CLEAR ALL POSTS ─────────────────────────────────────────────
app.get('/clear', (req, res) => {
  generatedPosts = [];
  lastRunTime = null;
  res.redirect('/');
});

// ─── START SERVER ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 X Post Generator running at http://localhost:${PORT}`);
  console.log(`   Select your niches and click "Generate" to start!\n`);
});
