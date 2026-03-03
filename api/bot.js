// api/bot.js
require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');
const { perplexity } = require('@ai-sdk/perplexity');
const { generateText } = require('ai');
const fs = require('fs').promises;
const https = require('https');
const path = require('path');

// CONFIGURABLE
const DAILY_TWEET_LIMIT = 3;
const LOOKBACK_DAYS = 7;
const POSTED_FILE = path.join(process.cwd(), 'posted_hindi_content.json');

// Hindi language codes and patterns for validation
const HINDI_LANGUAGE_CODES = ['hi', 'hindi'];
const HINDI_KEYWORDS = ['हिंदी', 'hindi', 'bollywood', 'देवनागरी'];

// Native HTTPS fetch
function fetchData(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode < 200 || res.statusCode > 299) {
        reject(new Error(`HTTP Error: ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Enhanced Hindi content validation
function isValidHindiContent(content) {
  // Check original language
  if (content.original_language !== 'hi') {
    return false;
  }

  // Check if title/name exists
  const title = content.title || content.name;
  if (!title || title.trim() === '') {
    return false;
  }

  // Check if overview exists and is meaningful
  if (!content.overview || content.overview.trim().length < 10) {
    return false;
  }

  // Check release/air date exists
  const releaseDate = content.release_date || content.first_air_date;
  if (!releaseDate) {
    return false;
  }

  // Additional validation: check if it's actually a recent release
  const today = new Date();
  const contentDate = new Date(releaseDate);
  const daysDiff = Math.ceil((today - contentDate) / (1000 * 60 * 60 * 24));

  if (daysDiff > LOOKBACK_DAYS || daysDiff < 0) {
    return false;
  }

  return true;
}

// Fetch ONLY Hindi movies or TV shows released in last N days from TMDB
async function getLatestHindiContent(contentType) {
  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setDate(today.getDate() - LOOKBACK_DAYS);
  const fromDateStr = fromDate.toISOString().slice(0, 10);
  const toDateStr = today.toISOString().slice(0, 10);

  let url;
  if (contentType === 'movie') {
    url =
      `https://api.themoviedb.org/3/discover/movie?` +
      `api_key=${process.env.TMDB_API_KEY}` +
      `&region=IN` +
      `&primary_release_date.gte=${fromDateStr}` +
      `&primary_release_date.lte=${toDateStr}` +
      `&with_original_language=hi` +
      `&sort_by=release_date.desc` +
      `&page=1`;
  } else if (contentType === 'tv') {
    const OTT_NETWORK_IDS = [213, 1024, 3919, 4624, 1021, 5201];
    url =
      `https://api.themoviedb.org/3/discover/tv?` +
      `api_key=${process.env.TMDB_API_KEY}` +
      `&region=IN` +
      `&first_air_date.gte=${fromDateStr}` +
      `&first_air_date.lte=${toDateStr}` +
      `&with_original_language=hi` +
      `&with_networks=${OTT_NETWORK_IDS.join(',')}` +
      `&sort_by=first_air_date.desc` +
      `&page=1`;
  } else {
    throw new Error('Invalid content type');
  }

  try {
    console.log(
      `🔍 Searching for HINDI ONLY ${
        contentType === 'movie' ? 'movies' : 'web series'
      } from ${fromDateStr} to ${toDateStr}`,
    );
    const data = await fetchData(url);
    if (!data.results || data.results.length === 0) {
      console.log(`No results found for Hindi ${contentType}`);
      return [];
    }

    // STRICT filtering for Hindi content only
    const hindiContent = data.results.filter(isValidHindiContent);

    console.log(`✅ Found ${hindiContent.length} VERIFIED Hindi ${contentType === 'movie' ? 'movies' : 'web series'}`);

    // Log the titles for verification
    hindiContent.forEach((content) => {
      const title = content.title || content.name;
      const date = content.release_date || content.first_air_date;
      console.log(`   📽️ "${title}" (${date}) - Lang: ${content.original_language}`);
    });

    return hindiContent;
  } catch (error) {
    console.error(`❌ TMDB fetch error (${contentType}):`, error.message);
    return [];
  }
}

// Get detailed info and double-check Hindi language
async function getContentDetails(content, contentType) {
  try {
    let url;
    if (contentType === 'movie') {
      url = `https://api.themoviedb.org/3/movie/${content.id}?api_key=${process.env.TMDB_API_KEY}&append_to_response=credits`;
    } else {
      url = `https://api.themoviedb.org/3/tv/${content.id}?api_key=${process.env.TMDB_API_KEY}&append_to_response=credits`;
    }
    const data = await fetchData(url);

    // Double-check Hindi language in detailed data
    if (data.original_language !== 'hi') {
      console.log(`⚠️ Skipping non-Hindi content: ${data.title || data.name} (Lang: ${data.original_language})`);
      return null;
    }

    return {
      ...content,
      title: contentType === 'movie' ? data.title : data.name,
      director:
        contentType === 'movie'
          ? data.credits?.crew?.find((p) => p.job === 'Director')?.name || 'Unknown'
          : (data.created_by && data.created_by[0]?.name) || 'Unknown',
      mainCast: data.credits?.cast?.slice(0, 3).map((a) => a.name) || [],
      genres: data.genres?.map((g) => g.name) || [],
      overview: data.overview,
      originalLanguage: data.original_language,
      posterPath: data.poster_path, // Add poster for image upload
    };
  } catch (error) {
    console.error(`Error fetching details for ${content.title || content.name}:`, error.message);
    return null;
  }
}

// Generate detailed Hinglish review like your example
async function generateReview(content, contentType) {
  const typeText = contentType === 'movie' ? 'Hindi movie' : 'Hindi web series';

  // Create a more detailed prompt for engaging reviews
  const prompt = `Write an engaging Hinglish review for this ${typeText} in exactly this style:
 mein ${content.genres[0] || 'drama'} aur ${content.mainCast.slice(0, 2).join(', ')} ki kahani hai ekdum ${
   contentType === 'tv' ? 'binge-worthy' : 'paisa wasool'
 }! 🔥 ${contentType === 'tv' ? 'Episodes' : 'Story'} ${contentType === 'tv' ? 'crazy' : 'solid'}, ek ${
   contentType === 'tv' ? 'addictive' : 'entertaining'
 } journey! ❤️

Requirements:
- Write in Hinglish (Hindi + English mix)
- Keep it exactly 2-3 lines
- Use emojis like 🔥 ❤️ 
- Focus on story/episodes being engaging
- Make it sound exciting and relatable
- Don't exceed 120 characters total

Content Details:
- Title: ${content.title}
- Cast: ${content.mainCast.join(', ')}
- Genres: ${content.genres.join(', ')}
- Synopsis: ${content.overview}`;

  try {
    console.log(`🤖 Generating engaging Hinglish review for: "${content.title}"`);
    // Note: Ensuring .env matches parameter name
    const { text } = await generateText({
      model: perplexity('sonar-pro', { apiKey: process.env.PPLX_API_KEY || process.env.PERPLEXITY_API_KEY }),
      prompt,
      maxTokens: 60,
    });
    return text.trim();
  } catch (error) {
    console.log(`AI review failed for ${content.title}, using engaging fallback`);
    const cast = content.mainCast.slice(0, 2).join(', ') || 'amazing cast';
    const genre = content.genres[0] || 'drama';

    if (contentType === 'tv') {
      return `mein ${genre} aur ${cast} ki kahani hai ekdum relatable! 🔥 Episodes crazy, ek addictive journey! ❤️`;
    } else {
      return `mein ${genre} aur ${cast} ki kahani hai ekdum paisa wasool! 🔥 Story solid, ek entertaining journey! ❤️`;
    }
  }
}

// Create title hashtag from title (max 15 chars for better formatting)
function createTitleHashtag(title) {
  return (
    '#' +
    title
      .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('')
      .slice(0, 15)
  );
}

// Enhanced tweet formatting like your example
function formatTweet(details, review, contentType) {
  const titleHashtag = createTitleHashtag(details.title);
  const emoji = contentType === 'movie' ? '🎬' : '🎬';

  // Base tweet
  let tweet = `${emoji} "${details.title}"\n\n${review}\n\n`;

  // Hashtags
  const tags =
    contentType === 'movie'
      ? `#Bollywood ${titleHashtag} #PopcornPremi`
      : `#HindiWebSeries #Bollywood ${titleHashtag} #PopcornPremi`;

  tweet += tags;

  return trimTweet(tweet);
}

// Trim tweet to 280 chars max
function trimTweet(text) {
  if (text.length <= 280) return text;
  let trimmed = text.slice(0, 279);
  const lastPeriod = trimmed.lastIndexOf('.');
  if (lastPeriod > 200) trimmed = trimmed.slice(0, lastPeriod + 1);
  return trimmed + '…';
}

// Load/save posted IDs
async function loadPostedContent() {
  try {
    const data = await fs.readFile(POSTED_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function savePostedContent(ids) {
  await fs.writeFile(POSTED_FILE, JSON.stringify(ids, null, 2));
}

// Download and upload poster image to Twitter
async function uploadPosterToTwitter(posterPath, client) {
  try {
    if (!posterPath) return null;

    const imageUrl = `https://image.tmdb.org/t/p/w500${posterPath}`;
    console.log(`📸 Downloading poster: ${imageUrl}`);

    return new Promise((resolve, reject) => {
      https
        .get(imageUrl, (res) => {
          if (res.statusCode !== 200) {
            console.log('⚠️ Could not download poster');
            resolve(null);
            return;
          }

          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', async () => {
            try {
              const buffer = Buffer.concat(chunks);
              const mediaId = await client.v1.uploadMedia(buffer, { mimeType: 'image/jpeg' });
              console.log('✅ Poster uploaded to Twitter');
              resolve(mediaId);
            } catch (error) {
              console.log('⚠️ Failed to upload poster to Twitter:', error.message);
              resolve(null);
            }
          });
        })
        .on('error', () => {
          console.log('⚠️ Error downloading poster');
          resolve(null);
        });
    });
  } catch (error) {
    console.log('⚠️ Poster upload error:', error.message);
    return null;
  }
}

// Post tweet with poster image
async function postTweet(text, posterPath = null) {
  // Configured to match generic configs from standard .env
  const client = new TwitterApi({
    appKey: process.env.X_API_KEY || process.env.TWITTER_API_KEY,
    appSecret: process.env.X_API_SECRET || process.env.TWITTER_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN || process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_SECRET || process.env.TWITTER_ACCESS_SECRET,
  });

  let mediaId = null;
  if (posterPath) {
    mediaId = await uploadPosterToTwitter(posterPath, client);
  }

  const tweetOptions = mediaId ? { media: { media_ids: [mediaId] } } : {};
  return await client.v2.tweet(text, tweetOptions);
}

// Validate environment variables
function validateEnvironment() {
  const tmdbKey = process.env.TMDB_API_KEY;
  const pplxKey = process.env.PPLX_API_KEY || process.env.PERPLEXITY_API_KEY;
  const xAppKey = process.env.X_API_KEY || process.env.TWITTER_API_KEY;
  const xAppSecret = process.env.X_API_SECRET || process.env.TWITTER_API_SECRET;
  const xAccessToken = process.env.X_ACCESS_TOKEN || process.env.TWITTER_ACCESS_TOKEN;
  const xAccessSecret = process.env.X_ACCESS_SECRET || process.env.TWITTER_ACCESS_SECRET;

  const missing = [];
  if (!tmdbKey) missing.push('TMDB_API_KEY');
  if (!pplxKey) missing.push('PERPLEXITY_API_KEY or PPLX_API_KEY');
  if (!xAppKey) missing.push('X_API_KEY');
  if (!xAppSecret) missing.push('X_API_SECRET');
  if (!xAccessToken) missing.push('X_ACCESS_TOKEN');
  if (!xAccessSecret) missing.push('X_ACCESS_SECRET');

  if (missing.length > 0) {
    console.error('❌ Missing environment variables:', missing.join(', '));
    process.exit(1);
  }
  console.log('✅ Environment variables validated');
}

// Main bot function - HINDI CONTENT ONLY
async function runBot() {
  try {
    console.log('🎬 HINDI-ONLY Bollywood & Web Series Review Bot\n');
    validateEnvironment();

    const postedIds = await loadPostedContent();
    console.log(`📚 Loaded ${postedIds.length} previously posted items`);

    const [movies, webseries] = await Promise.all([getLatestHindiContent('movie'), getLatestHindiContent('tv')]);

    console.log(`\n📊 Content Summary:`);
    console.log(`   Movies: ${movies.length} Hindi movies found`);
    console.log(`   Web Series: ${webseries.length} Hindi web series found`);

    const allContent = [
      ...movies.map((m) => ({ ...m, _type: 'movie' })),
      ...webseries.map((w) => ({ ...w, _type: 'tv' })),
    ];

    const uniqueContent = allContent.filter(
      (item, idx, arr) => arr.findIndex((x) => x.id === item.id && x._type === item._type) === idx,
    );

    const newContent = uniqueContent
      .filter((c) => !postedIds.includes(`${c._type}_${c.id}`))
      .sort((a, b) => {
        const aDate = new Date(a.release_date || a.first_air_date);
        const bDate = new Date(b.release_date || b.first_air_date);
        return bDate - aDate;
      });

    if (newContent.length === 0) {
      console.log('✅ No new Hindi movies or web series to review (all already posted).');
      return;
    }

    const todaysContent = newContent.slice(0, DAILY_TWEET_LIMIT);

    console.log(`\n🎯 Processing ${todaysContent.length} latest Hindi content items:\n`);

    for (const content of todaysContent) {
      try {
        const title = content.title || content.name;
        const type = content._type === 'movie' ? 'Movie' : 'Web Series';
        console.log(`📽️ Processing Hindi ${type}: "${title}"`);

        const details = await getContentDetails(content, content._type);

        if (!details) {
          console.log(`⚠️ Skipped: Could not verify Hindi language for "${title}"`);
          continue;
        }

        const review = await generateReview(details, content._type);
        const tweet = formatTweet(details, review, content._type);

        console.log('\n📝 Tweet preview (Hindi content):');
        console.log('─'.repeat(50));
        console.log(tweet);
        console.log('─'.repeat(50));
        console.log(`📊 Length: ${tweet.length} characters | Language: Hindi`);

        console.log('\n🐦 Posting Hindi content to Twitter with poster...');
        await postTweet(tweet, details.posterPath);

        console.log(`✅ Successfully tweeted Hindi ${type}: "${details.title}"`);

        postedIds.push(`${content._type}_${content.id}`);
        await savePostedContent(postedIds);

        if (todaysContent.indexOf(content) < todaysContent.length - 1) {
          console.log('⏳ Waiting 30 seconds before next tweet...\n');
          await new Promise((res) => setTimeout(res, 30000));
        }
      } catch (error) {
        const title = content.title || content.name;
        console.error(`❌ Error processing Hindi content "${title}":`, error.message);
      }
    }

    const remaining = newContent.length - todaysContent.length;
    if (remaining > 0) {
      console.log(`\n🚦 ${remaining} more Hindi content items remain for future tweets.`);
    }

    console.log(`\n🎉 Hindi Content Bot completed! Posted ${todaysContent.length} reviews today.`);
  } catch (error) {
    console.error('💥 Bot execution failed:', error.message);
    process.exit(1);
  }
}

// For Vercel serverless function:
module.exports = async (req, res) => {
  try {
    await runBot();
    if (res) res.status(200).json({ status: 'Hindi content bot ran successfully' });
  } catch (error) {
    console.error('Bot execution error:', error);
    if (res) {
      res.status(500).json({
        error: 'Bot execution failed',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }
};

// For local/manual run:
if (require.main === module) {
  runBot();
}
