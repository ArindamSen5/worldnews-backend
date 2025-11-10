# SmartWorldNews Backend

This Node.js Express backend fetches news from NewsAPI.org and uses OpenAI to generate short summaries.
It exposes a single endpoint: `GET /api/news`

## Quickstart

1. Copy `.env.example` to `.env` and fill your keys:
   - NEWSAPI_KEY (https://newsapi.org)
   - OPENAI_API_KEY (https://platform.openai.com)
   - API_KEY (a shared secret for your app to call the server)

2. Install and run:
   ```
   npm install
   npm start
   ```

3. Test:
   ```
   curl http://localhost:8080/api/ping
   curl -H "x-api-key: <API_KEY>" http://localhost:8080/api/news
   ```

## Deploy to Render.com

1. Create a new Web Service in Render.
2. Connect your GitHub repo, or deploy via Docker/zip.
3. Set Environment variables on Render from your `.env`.
4. Render will run `npm start` automatically.

## Notes
- The backend caches results for CACHE_TTL seconds to reduce API usage.
- For production, use HTTPS and consider server-side verification for subscriptions.
