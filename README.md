# Agentic AI Support Desk (React + Vite + Express + LangChain/LangGraph)

## Prereqs
- Node.js **18+** (you have Node v22 already)
- npm (comes with Node)

## 1) Install dependencies
From the project root:

```bash
cd server && npm install
cd ..\client && npm install
```

## 2) Environment variables (API keys + URLs)

### Backend (`server/.env`)
Required for the core “generate reply” feature:
- **`OPENAI_API_KEY`**: from your OpenAI account (API keys page)

Optional (only needed if you want web-search sources):
- **`TAVILY_API_KEY`**: from Tavily

Optional (only needed if you want Scalekit SSO login instead of dev login):
- **`SCALEKIT_ENVIRONMENT_URL`**
- **`SCALEKIT_CLIENT_ID`**
- **`SCALEKIT_CLIENT_SECRET`**

Other important values:
- **`SESSION_JWT_SECRET`**: set to a long random string
- **`FRONTEND_URL`**: should match your Vite dev URL (default `http://localhost:5173`)
- **`BACKEND_URL`**: should match your Express URL (default `http://localhost:5000`)

See `server/.env.example` for a template.

### Frontend (`client/.env`)
- **`VITE_BACKEND_URL`**: backend base URL (default `http://localhost:5000`)
- **`VITE_E2E_TEST_MODE`**:
  - `true` = shows a **Dev login (no Scalekit)** button on the login screen
  - `false` = only shows the Scalekit “Login” button

See `client/.env.example` for a template.

## 3) Run the app (dev)
Run these in two terminals:

### Terminal A (backend)
```bash
cd server
npm run dev
```
Backend health check: `http://localhost:5000/status`

### Terminal B (frontend)
```bash
cd client
npm run dev
```
Open: `http://localhost:5173`

## 4) How to login

### Option A (recommended for local dev): Dev login (no Scalekit)
1. Ensure `server/.env` has `E2E_TEST_MODE=true`
2. Ensure `client/.env` has `VITE_E2E_TEST_MODE=true`
3. Open the app → click **Dev login (no Scalekit)**

### Option B: Scalekit login (production-like)
1. Fill `SCALEKIT_ENVIRONMENT_URL`, `SCALEKIT_CLIENT_ID`, `SCALEKIT_CLIENT_SECRET` in `server/.env`
2. Make sure your Scalekit app has a redirect/callback URL pointing to:
   - `http://localhost:5000/auth/callback`
3. Open the app → click **Login**

## 5) Running tests (TestSprite)
The repo includes `testsprite_tests/` with API tests that validate cookie auth flows.

If you just want to run them as normal Python tests, you’ll need Python + dependencies as described by your TestSprite setup.
The backend endpoints under test are:
- `GET /status`
- `POST /auth/e2e/login` (dev only)
- `GET /auth/me`
- `POST /api/support/run` (must be authenticated)

