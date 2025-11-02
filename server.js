// server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// serve static frontend files from /public
app.use(express.static(path.join(__dirname, 'public')));

// if root requested, send index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// demo DB
const demoDB = [
  {title:"Findora Weather", link:"https://weather.com", desc:"Today's forecast and humidity info."},
  {title:"Findora News — Top stories", link:"https://example.com/news", desc:"Local & global news, sports, culture."},
  {title:"Recipes: Best Dolma", link:"https://example.com/recipes/dolma", desc:"Classic dolma recipe — step-by-step."},
  {title:"Liverpool Fan Club", link:"https://example.com/liverpool", desc:"Match schedules and fan meetups."},
  {title:"JS Starter Guide", link:"https://developer.mozilla.org", desc:"Official resources for learning JavaScript."}
];

function makeResult(title, link, desc) {
  return { title, link, desc };
}

app.get('/api/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.status(400).json({ error: 'Missing q parameter' });
    const qLower = q.toLowerCase();

    const localHits = demoDB.filter(r =>
      (r.title + ' ' + r.desc).toLowerCase().includes(qLower)
    ).map(r => makeResult(r.title, r.link, r.desc));

    if (localHits.length > 0) {
      return res.json({ source: 'local', query: q, results: localHits });
    }

    const ddgUrl = 'https://api.duckduckgo.com/';
    const params = { q, format: 'json', no_html: 1, skip_disambig: 1 };
    const ddgResp = await axios.get(ddgUrl, { params, timeout: 5000 });
    const ddg = ddgResp.data || {};

    const results = [];
    if (ddg.AbstractText) {
      results.push(makeResult(ddg.Heading || q, ddg.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(q)}`, ddg.AbstractText));
    }

    const pushRelated = (items) => {
      if (!Array.isArray(items)) return;
      for (const it of items) {
        if (it.Text && it.FirstURL) {
          results.push(makeResult(it.Text.split(' - ')[0], it.FirstURL, it.Text));
        } else if (it.Topics) {
          pushRelated(it.Topics);
        }
        if (results.length >= 8) break;
      }
    };
    pushRelated(ddg.RelatedTopics);

    if (results.length === 0) {
      results.push(makeResult(`Search the web for "${q}"`, `https://www.google.com/search?q=${encodeURIComponent(q)}`, `Open a web search for "${q}"`));
    }
    return res.json({ source: 'duckduckgo', query: q, results });
  } catch (err) {
    console.error('Search error', err?.message || err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/lucky', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.status(400).json({ error: 'Missing q parameter' });
    const qLower = q.toLowerCase();

    const localFirst = demoDB.find(r => (r.title + ' ' + r.desc).toLowerCase().includes(qLower));
    if (localFirst) {
      return res.json({ source: 'local', query: q, result: makeResult(localFirst.title, localFirst.link, localFirst.desc) });
    }

    const ddgUrl = 'https://api.duckduckgo.com/';
    const params = { q, format: 'json', no_html: 1, skip_disambig: 1 };
    const ddgResp = await axios.get(ddgUrl, { params, timeout: 5000 });
    const ddg = ddgResp.data || {};

    if (ddg.AbstractText) {
      return res.json({ source: 'duckduckgo', query: q, result: makeResult(ddg.Heading || q, ddg.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(q)}`, ddg.AbstractText) });
    }

    const findFirst = (items) => {
      if (!Array.isArray(items)) return null;
      for (const it of items) {
        if (it.FirstURL && it.Text) return it;
        if (it.Topics) {
          const sub = findFirst(it.Topics);
          if (sub) return sub;
        }
      }
      return null;
    };
    const firstRelated = findFirst(ddg.RelatedTopics);
    if (firstRelated) {
      return res.json({ source: 'duckduckgo', query: q, result: makeResult(firstRelated.Text.split(' - ')[0], firstRelated.FirstURL, firstRelated.Text) });
    }

    return res.json({ source: 'fallback', query: q, result: makeResult(`Search "${q}"`, `https://www.google.com/search?btnI=I&q=${encodeURIComponent(q)}`, `Open web search for "${q}"`) });
  } catch (err) {
    console.error('Lucky error', err?.message || err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Findora API listening on http://localhost:${PORT}`);
});
