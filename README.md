# AItasks

AI-Powered Task Planning & Productivity Assistant.

Stage 3 adds authenticated natural-language task parsing with Gemini. AI planning, prioritization, breakdown, and analytics remain future stages.

## Project structure

- `client/` — React + Vite + Tailwind CSS
- `server/` — Node.js + Express + PostgreSQL connection

## Prerequisites

- Node.js 18 or later
- PostgreSQL (required for authentication and task management; the API still starts if the database is offline)

## Backend

```bash
cd server
npm install
copy .env.example .env
npm run dev
```

The API runs at `http://localhost:5000`.

Health check: `GET http://localhost:5000/api/health`

Authenticated task endpoints use the bearer token returned by registration/login:

- `GET /api/tasks` (supports `search`, `status`, `priority`, `sort`, and `order`)
- `POST /api/tasks`
- `GET /api/tasks/:id`
- `PATCH /api/tasks/:id` and `PUT /api/tasks/:id`
- `PATCH /api/tasks/:id/status`
- `DELETE /api/tasks/:id`
- `GET /api/tasks/stats`
- `POST /api/ai/tasks/parse` (authenticated; parses text into an editable task preview and does not save it)

The `tasks` table and indexes are initialized on startup without modifying existing users.

Configure `DATABASE_URL`, `JWT_SECRET`, `PORT`, and `CLIENT_URL` in `server/.env`. AI parsing uses Gemini by default; set `GEMINI_API_KEY` (and optionally `AI_PROVIDER` or `GEMINI_MODEL`) in the server environment only. Never put the Gemini key in the client environment or frontend code.
The app expects a PostgreSQL connection string and a secure random JWT secret for authentication.

## Frontend

```bash
cd client
npm install
npm run dev
```

The app runs at `http://localhost:5173`.
