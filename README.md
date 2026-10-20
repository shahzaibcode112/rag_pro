# DocChat: RAG with FastAPI + React + Supabase (Postgres + Auth)

```
frontend/   React (Vite) app. Source in src/, built output in dist/
main.py     FastAPI backend: /api/* endpoints + serves frontend/dist
auth.py     checks the user's Supabase login token on every API request
ingest.py   chunk, embed, store in Supabase (Postgres + pgvector); list/delete documents
answer.py   similarity search + streamed LLM answer
schema.sql  run once in the Supabase SQL Editor
```

## Environment variables (.env locally, Render "Environment" in production)
```
OPENROUTER_API_KEY=...
DATABASE_URL=postgres://...pooler.supabase.com:5432/postgres   (Session pooler string)
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co               (Project URL)
SUPABASE_ANON_KEY=...                                           (the PUBLIC anon/publishable key, never the service_role/secret key)
```

## Supabase Auth settings (Dashboard)
- Authentication > Providers > Email: enabled. Turn "Confirm email" OFF while testing
  (the default email sender is limited to only a few emails per hour).
- Authentication > URL Configuration: set Site URL to your app URL, and add it
  (plus http://localhost:8000 and http://localhost:5173) to Redirect URLs.

## Run locally (development)
Terminal 1, backend:
```
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
Terminal 2, React with hot reload:
```
cd frontend
npm install
npm run dev          # open http://localhost:5173  (it proxies /api to port 8000)
```

## Tests (frontend)
```
cd frontend && npm test
```

## Build the frontend for production
```
cd frontend && npm run build     # creates frontend/dist
```
FastAPI serves `frontend/dist`, so it is one service. Commit `frontend/dist` after every build.

## Deploy on Render
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Environment variables: the four above.
