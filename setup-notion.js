// setup-notion.js
// Run ONCE to create the Notion database with correct columns
// Usage: node setup-notion.js

'use strict';

require('dotenv').config();
const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function createDatabase() {
  console.log('🔧 Creating Notion database...');

  // You need a parent PAGE id — create a blank Notion page first
  // then paste its ID here or in NOTION_PARENT_PAGE_ID env var
  const parentPageId = process.env.NOTION_PARENT_PAGE_ID;
  if (!parentPageId) {
    console.error('❌ Set NOTION_PARENT_PAGE_ID in your .env file first!');
    console.log('\nHow to find it:');
    console.log('1. Create a new blank page in Notion');
    console.log('2. Copy the URL: notion.so/your-workspace/PAGE_ID?v=...');
    console.log('3. The 32-char string before the ? is your PAGE_ID');
    process.exit(1);
  }

  const db = await notion.databases.create({
    parent: { type: 'page_id', page_id: parentPageId },
    title: [{ type: 'text', text: { content: '🐦 X Post Generator' } }],
    icon: { type: 'emoji', emoji: '🐦' },
    properties: {
      // ── Main columns ─────────────────────────────────────────
      Tweet: {
        title: {}, // Primary column — the tweet text
      },
      Category: {
        select: {
          options: [
            { name: 'cricket', color: 'blue' },
            { name: 'tech', color: 'purple' },
            { name: 'india', color: 'orange' },
            { name: 'bollywood', color: 'pink' },
            { name: 'ott', color: 'green' },
            { name: 'reality_shows', color: 'yellow' },
            { name: 'finance', color: 'red' },
            { name: 'world', color: 'gray' },
          ],
        },
      },
      Status: {
        select: {
          options: [
            { name: '⏳ Review', color: 'yellow' },
            { name: '✅ Approved', color: 'green' },
            { name: '🚀 Posted', color: 'blue' },
            { name: '❌ Skip', color: 'red' },
          ],
        },
      },
      Score: {
        select: {
          options: [
            { name: '🔥 High', color: 'red' },
            { name: '✅ Good', color: 'green' },
            { name: '📝 Average', color: 'gray' },
          ],
        },
      },
      Characters: {
        number: { format: 'number' },
      },
      'Source Headline': {
        rich_text: {},
      },
      'Generated At': {
        date: {},
      },
    },
  });

  console.log('\n✅ Notion database created!');
  console.log(`\n📋 Database ID: ${db.id}`);
  console.log('\nNext steps:');
  console.log(`1. Add this to your .env and Vercel env vars:`);
  console.log(`   NOTION_DATABASE_ID=${db.id}`);
  console.log('2. Run: vercel deploy');
  console.log('\nYour Notion database views are set up automatically.');
  console.log('Open Notion and you\'ll see the "🐦 X Post Generator" database.');

  return db.id;
}

createDatabase().catch(console.error);
