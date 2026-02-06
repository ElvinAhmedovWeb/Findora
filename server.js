// server.js — Findora image-proxy enabled
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Basic security & parsing ---
app.disable('x-powered-by');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Helmet with CSP tuned for this app ---
// allow scripts/styles from self and cdn; images will be served from self (proxy)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'", "https://api.duckduckgo.com", "https://az.wikipedia.org"],
        fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      },
    },
  })
);

// --- CORS whitelist (allow frontends you use) ---
const FRONT_ORIGINS = (process.env.FRONT_ORIGINS || 'http://localhost:3000').split(',');
app.use(cors({
  origin: function(origin, cb) {
    // allow server-to-server or no-origin requests (curl)
    if (!origin) return cb(null, true);
    if (FRONT_ORIGINS.indexOf(origin) !== -1) return cb(null, true);
    return cb(new Error('Not allowed by CORS'), false);
  },
  methods: ['GET']
}));

// --- Rate limit for /api endpoints ---
app.use('/api/', rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // increase slightly to allow image loads; tune as needed
  standardHeaders: true,
  legacyHeaders: false
}));

// --- Simple in-memory cache (for API responses and images) ---
const cache = new Map();
function setCache(key, value, ttlSec = 3600) { // default 1 hour
  const expires = Date.now() + ttlSec * 1000;
  cache.set(key, { value, expires });
}
function getCache(key) {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() > e.expires) { cache.delete(key); return null; }
  return e.value;
}
// periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of cache.entries()) if (v.expires <= now) cache.delete(k);
}, 60 * 1000);

// --- Serve static frontend files (index.html, search.html, ... ) ---
app.use(express.static(path.resolve(__dirname)));

// --- Helpers: Wikipedia + DuckDuckGo ---
// getWikiData returns { title, url, desc, image } or null
async function getWikiData(query) {
  try {
    const url = `https://az.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|pageimages&exintro&explaintext&titles=${encodeURIComponent(query)}&pithumbsize=500`;
    const r = await axios.get(url, { timeout: 5000 });
    const pages = r.data && r.data.query && r.data.query.pages;
    if (!pages) return null;
    const pageId = Object.keys(pages)[0];
    if (pageId === "-1") return null;
    const p = pages[pageId];
    const rawImage = p.thumbnail ? p.thumbnail.source : '';
    const proxiedImage = rawImage ? `/api/image?u=${encodeURIComponent(rawImage)}` : '';
    return {
      title: (p.title || query) + " (Wikipedia)",
      url: `https://az.wikipedia.org/wiki/${encodeURIComponent(p.title)}`,
      desc: p.extract ? (p.extract.substring(0, 600)) : '',
      image: proxiedImage
    };
  } catch (err) {
    console.error('Wiki error:', err.message || err);
    return null;
  }
}

// DuckDuckGo results; convert any image/icon into proxied URL
async function getDuckDuckGoResults(query) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
    const r = await axios.get(url, { timeout: 5000 });
    const data = r.data || {};
    const results = [];

    if (data.AbstractText) {
      const rawImg = data.Image || '';
      const img = rawImg ? `/api/image?u=${encodeURIComponent(rawImg)}` : '';
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        desc: data.AbstractText,
        image: img
      });
    }

    const topics = Array.isArray(data.RelatedTopics) ? data.RelatedTopics : [];
    for (let t of topics.slice(0, 8)) {
      if (t && t.Topics && Array.isArray(t.Topics)) {
        for (let sub of t.Topics.slice(0, 3)) {
          if (sub.Text && sub.FirstURL) {
            const rawIcon = (sub.Icon && sub.Icon.URL) ? (sub.Icon.URL.startsWith('/') ? `https://duckduckgo.com${sub.Icon.URL}` : sub.Icon.URL) : '';
            const img = rawIcon ? `/api/image?u=${encodeURIComponent(rawIcon)}` : '';
            results.push({ title: sub.Text.split(' - ')[0], url: sub.FirstURL, desc: sub.Text, image: img });
          }
        }
      } else {
        if (t && t.Text && t.FirstURL) {
          const rawIcon = (t.Icon && t.Icon.URL) ? (t.Icon.URL.startsWith('/') ? `https://duckduckgo.com${t.Icon.URL}` : t.Icon.URL) : '';
          const img = rawIcon ? `/api/image?u=${encodeURIComponent(rawIcon)}` : '';
          results.push({ title: t.Text.split(' - ')[0], url: t.FirstURL, desc: t.Text, image: img });
        }
      }
    }
    return results;
  } catch (err) {
    console.error('DuckDuckGo error:', err.message || err);
    return [];
  }
}

// --- Image proxy endpoint ---
// GET /api/image?u=<encodedUrl>
app.get('/api/image', async (req, res) => {
  const u = req.query.u;
  if (!u) return res.status(400).send('missing url');

  // decode URL
  let url;
  try {
    url = decodeURIComponent(u);
  } catch (e) {
    return res.status(400).send('invalid url');
  }

  // Only allow https to avoid leaking internal resources
  try {
    const parsed = new URL(url);
    if (!['https:'].includes(parsed.protocol)) {
      return res.status(400).send('only https images allowed');
    }
  } catch (e) {
    return res.status(400).send('invalid url');
  }

  const cacheKey = `img:${url}`;
  const cached = getCache(cacheKey);
  if (cached) {
    res.set('Content-Type', cached.type);
    res.set('Cache-Control', 'public, max-age=86400'); // 1 day
    return res.send(Buffer.from(cached.data, 'base64'));
  }

  try {
    // HEAD first to validate content-type and length (faster)
    let head;
    try {
      head = await axios.head(url, { timeout: 5000, maxRedirects: 5 });
    } catch (errHead) {
      // Some hosts block HEAD; fallback to GET's headers later
      head = null;
    }

    const contentType = head?.headers['content-type'] || '';
    if (contentType && !contentType.startsWith('image/')) {
      return res.status(400).send('not an image');
    }

    const lenHeader = head?.headers['content-length'];
    const MAX_BYTES = parseInt(process.env.IMG_MAX_BYTES || String(5 * 1024 * 1024), 10); // default 5MB
    if (lenHeader && parseInt(lenHeader, 10) > MAX_BYTES) {
      return res.status(413).send('image too large');
    }

    // Fetch as arraybuffer to allow caching and content-type check
    const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000, maxRedirects: 5 });
    const finalType = resp.headers['content-type'] || 'application/octet-stream';
    if (!finalType.startsWith('image/')) {
      return res.status(400).send('not an image');
    }

    const buffer = Buffer.from(resp.data);
    if (buffer.length > MAX_BYTES) {
      return res.status(413).send('image too large');
    }

    // save to cache (Base64 for safe storage)
    setCache(cacheKey, { type: finalType, data: buffer.toString('base64') }, 60 * 60); // 1 hour TTL

    res.set('Content-Type', finalType);
    res.set('Cache-Control', 'public, max-age=86400'); // browsers can cache for a day
    return res.send(buffer);
  } catch (err) {
    console.error('Image proxy error for', url, err.message || err);
    return res.status(502).send('bad gateway');
  }
});

// --- API: /api/search?q=...&type=all|image|video ---
// same logic as before but returns image URLs proxied via /api/image
app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  const type = (req.query.type || 'all').toLowerCase();

  if (!q) return res.status(400).json({ error: 'empty query' });

  const cacheKey = `search:${type}:${q.toLowerCase()}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    const [wiki, ddg] = await Promise.all([getWikiData(q), getDuckDuckGoResults(q)]);
    let results = wiki ? [wiki, ...ddg] : ddg;

    if (type === 'image') {
      results = results.filter(r => r.image && r.image.length);
    } else if (type === 'video') {
      // placeholder
    }

    const payload = { query: q, type, results };
    setCache(cacheKey, payload, 45);
    return res.json(payload);
  } catch (err) {
    console.error('Search API error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// --- Fallback for frontend routes (keep after /api) ---
app.use((req, res) => {
  res.sendFile(path.resolve(__dirname, 'index.html'));
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`✅ Findora API listening on port ${PORT}`);
});
