// server.js — Findora AI Search Engine
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Groq = require('groq-sdk');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Groq AI Client ──
const GROQ_API_KEY = process.env.GROQ_API_KEY || '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';
const groq = new Groq({ apiKey: GROQ_API_KEY });

// --- Basic security & parsing ---
app.disable('x-powered-by');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Helmet with CSP tuned for this app ---
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.duckduckgo.com", "https://az.wikipedia.org", "https://en.wikipedia.org", "https://commons.wikimedia.org"],
        fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
      },
    },
  })
);

// --- CORS ---
const FRONT_ORIGINS = (process.env.FRONT_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5500,http://127.0.0.1:5500').split(',');
app.use(cors({
  origin: function (origin, cb) {
    if (!origin) return cb(null, true);
    if (FRONT_ORIGINS.indexOf(origin) !== -1) return cb(null, true);
    return cb(null, true); // Allow all in dev
  },
  methods: ['GET', 'POST']
}));

// --- Rate limit ---
app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false
}));

// --- Simple in-memory cache ---
const cache = new Map();
function setCache(key, value, ttlSec = 3600) {
  cache.set(key, { value, expires: Date.now() + ttlSec * 1000 });
}
function getCache(key) {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() > e.expires) { cache.delete(key); return null; }
  return e.value;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of cache.entries()) if (v.expires <= now) cache.delete(k);
}, 60 * 1000);

// --- Serve static frontend files ---
app.use(express.static(path.resolve(__dirname)));

// ════════════════════════════════════════
//  HELPERS: Wikipedia + DuckDuckGo
// ════════════════════════════════════════

// Wikipedia data (Azerbaijani first, fallback to English)
async function getWikiData(query) {
  // Try AZ first, then EN
  for (const lang of ['az', 'en']) {
    try {
      const url = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|pageimages&exintro&explaintext&titles=${encodeURIComponent(query)}&pithumbsize=500&origin=*`;
      const r = await axios.get(url, { timeout: 5000 });
      const pages = r.data?.query?.pages;
      if (!pages) continue;
      const pageId = Object.keys(pages)[0];
      if (pageId === "-1") continue;
      const p = pages[pageId];
      const rawImage = p.thumbnail ? p.thumbnail.source : '';
      const proxiedImage = rawImage ? `/api/image?u=${encodeURIComponent(rawImage)}` : '';
      return {
        title: (p.title || query) + ` (Wikipedia ${lang.toUpperCase()})`,
        url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(p.title)}`,
        desc: p.extract ? p.extract.substring(0, 800) : '',
        image: proxiedImage,
        favicon: `https://www.google.com/s2/favicons?domain=${lang}.wikipedia.org&sz=32`
      };
    } catch (err) {
      console.error(`Wiki ${lang} error:`, err.message);
    }
  }
  return null;
}

// DuckDuckGo search results
async function getDuckDuckGoResults(query) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
    const r = await axios.get(url, { timeout: 5000 });
    const data = r.data || {};
    const results = [];

    if (data.AbstractText) {
      const rawImg = data.Image || '';
      const img = rawImg ? `/api/image?u=${encodeURIComponent(rawImg.startsWith('/') ? 'https://duckduckgo.com' + rawImg : rawImg)}` : '';
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        desc: data.AbstractText,
        image: img,
        source: data.AbstractSource || 'DuckDuckGo'
      });
    }

    const topics = Array.isArray(data.RelatedTopics) ? data.RelatedTopics : [];
    for (let t of topics.slice(0, 12)) {
      if (t?.Topics && Array.isArray(t.Topics)) {
        for (let sub of t.Topics.slice(0, 4)) {
          if (sub.Text && sub.FirstURL) {
            const rawIcon = sub.Icon?.URL ? (sub.Icon.URL.startsWith('/') ? `https://duckduckgo.com${sub.Icon.URL}` : sub.Icon.URL) : '';
            const img = rawIcon ? `/api/image?u=${encodeURIComponent(rawIcon)}` : '';
            try {
              const domain = new URL(sub.FirstURL).hostname;
              results.push({
                title: sub.Text.split(' - ')[0],
                url: sub.FirstURL,
                desc: sub.Text,
                image: img,
                favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
              });
            } catch { }
          }
        }
      } else if (t?.Text && t?.FirstURL) {
        const rawIcon = t.Icon?.URL ? (t.Icon.URL.startsWith('/') ? `https://duckduckgo.com${t.Icon.URL}` : t.Icon.URL) : '';
        const img = rawIcon ? `/api/image?u=${encodeURIComponent(rawIcon)}` : '';
        try {
          const domain = new URL(t.FirstURL).hostname;
          results.push({
            title: t.Text.split(' - ')[0],
            url: t.FirstURL,
            desc: t.Text,
            image: img,
            favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
          });
        } catch { }
      }
    }
    return results;
  } catch (err) {
    console.error('DuckDuckGo error:', err.message);
    return [];
  }
}

// Wikipedia image search
async function getWikiImages(query) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&generator=images&titles=${encodeURIComponent(query)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=400&origin=*&gimlimit=20`;
    const r = await axios.get(url, { timeout: 6000 });
    const pages = r.data?.query?.pages;
    if (!pages) return [];

    const images = [];
    for (const p of Object.values(pages)) {
      const info = p.imageinfo?.[0];
      if (!info?.url) continue;
      // Only show actual images, skip SVGs and icons
      if (info.url.match(/\.(svg|ico)$/i)) continue;
      const title = p.title?.replace('File:', '') || '';
      images.push({
        title: title,
        url: info.descriptionurl || info.url,
        image: `/api/image?u=${encodeURIComponent(info.thumburl || info.url)}`,
        source: 'Wikimedia Commons'
      });
    }
    return images;
  } catch (err) {
    console.error('Wiki images error:', err.message);
    return [];
  }
}

// DuckDuckGo suggestions
async function getSuggestions(query) {
  try {
    const url = `https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}&type=list`;
    const r = await axios.get(url, { timeout: 3000 });
    if (Array.isArray(r.data)) {
      return r.data.map(item => item.phrase || item).filter(Boolean).slice(0, 8);
    }
    return [];
  } catch {
    return [];
  }
}

// ════════════════════════════════════════
//  IMAGE PROXY
// ════════════════════════════════════════
app.get('/api/image', async (req, res) => {
  const u = req.query.u;
  if (!u) return res.status(400).send('missing url');

  let url;
  try { url = decodeURIComponent(u); } catch { return res.status(400).send('invalid url'); }

  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) return res.status(400).send('only http(s) allowed');
  } catch { return res.status(400).send('invalid url'); }

  const cacheKey = `img:${url}`;
  const cached = getCache(cacheKey);
  if (cached) {
    res.set('Content-Type', cached.type);
    res.set('Cache-Control', 'public, max-age=86400');
    return res.send(Buffer.from(cached.data, 'base64'));
  }

  try {
    const resp = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      maxRedirects: 5,
      headers: { 'User-Agent': 'FindoraBot/1.0' }
    });
    const finalType = resp.headers['content-type'] || 'application/octet-stream';
    const buffer = Buffer.from(resp.data);
    const MAX_BYTES = 5 * 1024 * 1024;
    if (buffer.length > MAX_BYTES) return res.status(413).send('image too large');

    setCache(cacheKey, { type: finalType, data: buffer.toString('base64') }, 3600);
    res.set('Content-Type', finalType);
    res.set('Cache-Control', 'public, max-age=86400');
    return res.send(buffer);
  } catch (err) {
    console.error('Image proxy error:', err.message);
    return res.status(502).send('bad gateway');
  }
});

// ════════════════════════════════════════
//  FAVICON PROXY
// ════════════════════════════════════════
app.get('/api/favicon', async (req, res) => {
  const domain = req.query.domain;
  if (!domain) return res.status(400).send('missing domain');
  const url = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;

  const cacheKey = `fav:${domain}`;
  const cached = getCache(cacheKey);
  if (cached) {
    res.set('Content-Type', cached.type);
    res.set('Cache-Control', 'public, max-age=604800'); // 1 week
    return res.send(Buffer.from(cached.data, 'base64'));
  }

  try {
    const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 5000 });
    const buffer = Buffer.from(resp.data);
    const type = resp.headers['content-type'] || 'image/png';
    setCache(cacheKey, { type, data: buffer.toString('base64') }, 86400);
    res.set('Content-Type', type);
    res.set('Cache-Control', 'public, max-age=604800');
    return res.send(buffer);
  } catch {
    return res.status(502).send('favicon fetch failed');
  }
});

// ════════════════════════════════════════
//  SEARCH SUGGESTIONS
// ════════════════════════════════════════
app.get('/api/suggest', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  const cacheKey = `sug:${q.toLowerCase()}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);
  const suggestions = await getSuggestions(q);
  setCache(cacheKey, suggestions, 300);
  return res.json(suggestions);
});

// ════════════════════════════════════════
//  GROQ AI CHAT
// ════════════════════════════════════════
app.post('/api/ai', async (req, res) => {
  const { question, context } = req.body;
  if (!question) return res.status(400).json({ error: 'no question' });

  const cacheKey = `ai:${question.toLowerCase().trim()}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    const systemPrompt = `Sən Findora süni intellekt köməkçisisən. Sənin adın Findora AI-dır. Azərbaycan dilində cavab ver.
Sorğulara qısa, dəqiq, və faydalı cavablar ver. Əgər kontekst verilsə, onu istifadə et.
Cavablarını formatla: əsas faktları qalın yaz, siyahılardan istifadə et.
Hər cavabın sonunda mənbə haqqında qısa məlumat ver.
Əgər sual çox ümumidisə, ən əhəmiyyətli məlumatları ver.`;

    const userMsg = context
      ? `Kontekst (axtarış nəticələrindən): ${context}\n\nSual: ${question}`
      : question;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 1024,
      top_p: 0.9,
    });

    const answer = chatCompletion.choices?.[0]?.message?.content || 'Cavab tapılmadı.';
    const result = { answer, model: 'llama-3.3-70b-versatile' };
    setCache(cacheKey, result, 120); // 2 min cache for AI
    return res.json(result);
  } catch (err) {
    console.error('Groq AI error:', err.message || err);
    return res.status(500).json({ error: 'AI xidmətində xəta baş verdi.', details: err.message });
  }
});

// ════════════════════════════════════════
//  MAIN SEARCH API
// ════════════════════════════════════════
app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  const type = (req.query.type || 'all').toLowerCase();
  if (!q) return res.status(400).json({ error: 'empty query' });

  const cacheKey = `search:${type}:${q.toLowerCase()}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  const startTime = Date.now();

  try {
    if (type === 'image') {
      // Image search: Wikipedia images + DDG images
      const [wikiImages, ddg] = await Promise.all([getWikiImages(q), getDuckDuckGoResults(q)]);
      const ddgImages = ddg.filter(r => r.image && r.image.length);
      const results = [...wikiImages, ...ddgImages];
      const payload = { query: q, type, results, time: ((Date.now() - startTime) / 1000).toFixed(2) };
      setCache(cacheKey, payload, 120);
      return res.json(payload);
    }

    // All / video
    const [wiki, ddg] = await Promise.all([getWikiData(q), getDuckDuckGoResults(q)]);
    let results = wiki ? [wiki, ...ddg] : ddg;

    // Add favicon to each result that doesn't have one
    results = results.map(r => {
      if (!r.favicon && r.url) {
        try {
          const domain = new URL(r.url).hostname;
          r.favicon = `/api/favicon?domain=${encodeURIComponent(domain)}`;
        } catch { }
      }
      return r;
    });

    const payload = {
      query: q,
      type,
      results,
      resultCount: results.length,
      time: ((Date.now() - startTime) / 1000).toFixed(2)
    };
    setCache(cacheKey, payload, 60);
    return res.json(payload);
  } catch (err) {
    console.error('Search API error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// --- Fallback ---
app.use((req, res) => {
  res.sendFile(path.resolve(__dirname, 'index.html'));
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`✅ Findora AI API listening on port ${PORT}`);
});
