# GravyFlow UI

Infrastructure canvas for GravyFlow — deploy services, stream build/runtime logs, manage environment variables, and attach custom domains.

Built with **Next.js 14** (App Router), **React 18**, **TypeScript**, **Tailwind CSS**, **Zustand**, and **Axios**.

---

## Prerequisites

Install these tools **before** running or deploying the frontend.

| Tool | Minimum version | Why it is required |
|------|-----------------|--------------------|
| **Node.js** | 18.18+ (20 LTS recommended) | Next.js 14 runtime and build toolchain |
| **npm** | 9+ (bundled with Node 20) | Installs dependencies from `package-lock.json` |
| **Git** | 2.x | Clone the repository and track releases |

### Install on Ubuntu / Debian

```bash
# Node.js 20 LTS (recommended)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

node -v   # should be v18.18+ or v20.x
npm -v    # should be 9+
git --version
```

### Install on macOS (Homebrew)

```bash
brew install node@20 git
node -v
npm -v
```

### Optional (local development only)

The UI talks to the GravyFlow **API** over HTTP and WebSockets. For a full local stack you also need the backend running (separate from this package):

| Tool | Purpose |
|------|---------|
| **Go 1.22+** | Build and run `cmd/api` |
| **PostgreSQL 15** | App metadata and deployments |
| **Redis 7** | Background job queue |
| **Docker** | Builds and runs deployed user apps (API side) |

The frontend itself does **not** require Docker, Go, Postgres, or Redis to build — only to function against a live API.

---

## Environment variables

Create a `.env.local` file in this directory for local development or set these in your hosting provider before deploy.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | No | `http://localhost:8080/api` | Base URL for REST calls and log WebSockets |

Example:

```bash
# .env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api
```

For production, point this at your public API origin, for example:

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api
```

**Note:** `next.config.mjs` includes a dev-only rewrite that proxies `/api/*` to `http://localhost:8080`. In production, the app uses `NEXT_PUBLIC_API_BASE_URL` directly — make sure that URL is reachable from the browser (CORS and WebSocket support on the API).

---

## Local development

From the `gravyflow-ui` directory:

```bash
# 1. Install dependencies
npm ci

# 2. Start the dev server (default port 3000)
npm run dev
```

If port 3000 is already in use:

```bash
npm run dev -- -p 3001
```

Open [http://localhost:3000](http://localhost:3000) (or the port you chose).

Ensure the GravyFlow API is running on port **8080** (or update `NEXT_PUBLIC_API_BASE_URL`).

---

## Production build & deploy

These steps assume prerequisites above are installed on the build machine or CI runner.

```bash
# 1. Install dependencies (use ci for reproducible builds)
npm ci

# 2. Set production API URL
export NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api

# 3. Create an optimized production bundle
npm run build

# 4. Start the Next.js production server
npm run start
```

By default, `npm run start` listens on port **3000**. Override with:

```bash
PORT=3001 npm run start
```

### Deploy targets

| Target | Notes |
|--------|-------|
| **Node.js VPS / PM2 / systemd** | Run `npm run build` then `npm run start` behind nginx or Caddy |
| **Docker** | Use a multi-stage Node image: `npm ci` → `npm run build` → `npm run start` |
| **Vercel / similar** | Set `NEXT_PUBLIC_API_BASE_URL` in project settings; ensure API allows your frontend origin |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build (`.next/` output) |
| `npm run start` | Serve the production build |
| `npm run lint` | Run Next.js ESLint checks |

---

## Project structure

```
gravyflow-ui/
├── app/                    # Next.js App Router pages & layouts
│   ├── (auth)/             # Login / register
│   └── dashboard/          # Main canvas workspace
├── components/
│   ├── canvas/             # Service grid, nodes, deploy button
│   ├── drawer/             # Logs, env, domains, redeploy actions
│   ├── auth/               # Protected routes, account menu
│   └── toast/              # In-app notifications
├── lib/api.ts              # Axios client + JWT refresh
├── store/                  # Zustand stores (auth, canvas, toasts)
└── tailwind.config.ts      # Design tokens and theme
```

---

## Troubleshooting

**Blank dashboard or API errors**

- Confirm the API is up: `curl http://localhost:8080/api/health`
- Check `NEXT_PUBLIC_API_BASE_URL` matches the API address
- Sign in again if JWT expired (log streaming uses WebSocket auth)

**Port already in use**

- Run dev on another port: `npm run dev -- -p 3001`

**Build fails on Node version**

- Upgrade to Node 18.18+ or 20 LTS; Next.js 14 does not support older Node releases

**Log stream disconnects**

- API must expose `GET /api/jobs/:jobId/stream` with WebSocket upgrade
- Token is passed as `?token=` query param; reverse proxies must allow WebSocket pass-through

---

## Deployment speed

Deploy time is controlled by the **GravyFlow API**, not the UI. What you click in the drawer matters:

| Action | When to use | Typical time |
|--------|-------------|--------------|
| **Restart service** (running app) | Env var changes, quick container refresh | Seconds — skips git clone and Docker build |
| **Redeploy** (failed / building) | New code, failed build, first deploy | 1–3+ minutes — clones repo and rebuilds image |

**Why redeploys feel slow**

1. **Git clone** — source is fetched each full deploy (shallow clone, usually fast).
2. **Docker image build** — the main cost (`npm ci`, `npm run build`, or Nixpacks for non-Node apps).
3. **Legacy Docker builder** — without `docker-buildx`, builds are slower but still work.

**Keep builds fast on the API host**

Set these when running the API (see repository root / `cmd/api`):

```bash
# Persist checkouts and Nixpacks cache across restarts
export GRAVYFLOW_APPS_DIR="$HOME/.gravyflow/apps"
export NIXPACKS_CACHE_DIR="$HOME/.gravyflow/nixpacks-cache"

# Optional: faster Docker builds (if buildx is installed)
sudo apt-get install -y docker-buildx
```

Node / Next.js / **Vite** repos with a `package.json` use a **fast Docker builder** instead of Nixpacks. Vite apps only need a `build` script (a `start` script is not required). Other stacks (Python, Go, etc.) still go through Nixpacks and take longer on first build; the cache directory above helps on repeat deploys.

Typical build times on a small VPS:

| Stack | Builder | First deploy | Redeploy (same deps) |
|-------|---------|--------------|----------------------|
| Vite / React | Fast (nginx) | ~1 min | ~30–60s if code changed |
| Next.js | Fast (multi-stage) | ~1–2 min | varies |
| Python / Go / other | Nixpacks | 5–15+ min | faster with cache |

After changing API code or env, rebuild and restart the API:

```bash
go build -o /tmp/gravyflow-api ./cmd/api
# restart your API process
```

---

## Related

- Backend API and deployment worker: `../cmd/api` (repository root)
- Database schema: `../db/schema.sql`
