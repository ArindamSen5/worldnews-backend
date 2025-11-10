// server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const NodeCache = require('node-cache');

const app = express();
app.use(cors());
app.use(express.json());

const cache = new NodeCache({ stdTTL: parseInt(process.env.CACHE_TTL || '60') });

const NEWSAPI_KEY = process.env.NEWSAPI_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const API_KEY = process.env.API_KEY || '';

if (!NEWSAPI_KEY || !OPENAI_API_KEY) {
  console.warn('Make sure NEWSAPI_KEY and OPENAI_API_KEY are set in .env');
}

async function fetchNews(q, pageSize=10) {
  const params = {
    apiKey: NEWSAPI_KEY,
    pageSize,
    language: 'en',
  };
  if (q) params.q = q;
  const url = `https://newsapi.org/v2/top-headlines`;
  const resp = await axios.get(url, { params });
  return resp.data.articles || [];
}

async function aiCurate(articles) {
  const systemPrompt = `You are a helpful assistant that reads a list of news articles (title + description + url).
For each article, produce a JSON object with fields: title, summary (max 40 words), source, url, publishedAt.
Return a JSON array only.`;

  let content = articles.map((a, i) => {
    return `Article ${i+1}:
Title: ${a.title || ''}
Description: ${a.description || ''}
Source: ${a.source && a.source.name ? a.source.name : ''}
URL: ${a.url || ''}
`;
  }).join('\n---\n');

  try {
    const openaiResp = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Articles:\n\n${content}\n\nReturn a JSON array.` }
      ],
      temperature: 0.2,
      max_tokens: 900
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const assistantText = openaiResp.data?.choices?.[0]?.message?.content || '';
    const jsonMatch = assistantText.match(/\[.*\]/s);
    const jsonText = jsonMatch ? jsonMatch[0] : assistantText;
    const parsed = JSON.parse(jsonText);
    return parsed;
  } catch (err) {
    console.warn('AI parsing failed, falling back to naive mapping:', err.message);
    return articles.map(a => ({
      title: a.title,
      summary: a.description || '',
      source: a.source && a.source.name,
      url: a.url,
      publishedAt: a.publishedAt
    }));
  }
}

app.get('/api/news', async (req, res) => {
  try {
    const apikey = req.headers['x-api-key'] || '';
    if (API_KEY && apikey !== API_KEY) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const q = req.query.q || '';
    const pageSize = parseInt(req.query.pageSize) || 10;
    const cacheKey = `news:${q}:${pageSize}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json({ success: true, articles: cached });

    const rawArticles = await fetchNews(q, pageSize);
    const curated = await aiCurate(rawArticles);
    cache.set(cacheKey, curated);
    return res.json({ success: true, articles: curated });
  } catch (err) {
    console.error('Error /api/news', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/ping', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 8080;
app.get("/", (req, res) => {
  res.send("✅ SmartWorldNews backend is running! Use /api/news to fetch AI-summarized news.");
});
app.listen(PORT, () => console.log(`News-AI backend listening on ${PORT}`));
