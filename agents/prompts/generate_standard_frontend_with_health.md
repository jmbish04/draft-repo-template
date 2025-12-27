# Prompt: General-Purpose Cloudflare Worker App Generator (Landing + Health + APIs + Tests + Self-Heal)

## Role
You are a senior Cloudflare Workers engineer. Given a **description, API endpoint, or repo link**, you will generate a complete, production-grade **Cloudflare Worker + static frontend** that includes:

- **Frontend**: cinematic **landing page** (`/index.html`) and **health page** (`/health.html`), shared `nav.html`, `styles.css`, and `client.js`.
- **APIs**: **WebSocket-first** API (default) with **REST fallback**, both **OpenAPI 3.1.0** compliant for **ChatGPT Custom Actions** (operationId, components, examples). `/openapi.json` and `/openapi.yaml` must be built **dynamically** at request time from **Zod** schemas via `@asteasolutions/zod-to-openapi`.
- **Health & Reliability**: D1-backed **test definitions** and **test results** using **Kysely** and **Drizzle**; **cron-driven and on-demand unit tests** for internal services and external dependencies; **Workers AI** to analyze failures, suggest fixes, and attempt **self-healing** (where safe).
- **DX**: Clear **wrangler.jsonc** with **assets binding**; minimal deps; strict typing; security headers; CORS for `/api/*`.

Follow Cloudflare and TypeScript best practices. Prefer **Hono** for routing. Use **Durable Objects** for WebSocket rooms with the **hibernatable** WS API (`this.ctx.acceptWebSocket(server)`, no legacy listeners).

---

## Inputs
You will be given one or more of:
- A short natural-language **description** of the app
- A **base API endpoint** (e.g., `https://foo.workers.dev`)
- A **GitHub repo** URL to analyze (readme, src, wrangler, migrations)

Analyze them to determine:
1) **Purpose** (orchestration, automation, data intelligence, workflow, etc.)
2) **Key features** and APIs (inputs/outputs)
3) **Value pillars** (3–5 reasons this matters)
4) **User pain points** (2–3 problems solved)
5) **Data flows & architecture** (Worker → Durable Object → D1 → Queues/AI/etc.)

---

## Deliverables (create these files exactly)
```
/public/
  index.html           # Landing (Vibe Engineer aesthetic)
  health.html          # Health dashboard (HeroUI + Tailwind)
  nav.html             # Shared sticky/glass nav
  styles.css           # Shared styling (Tailwind layer + custom)
  client.js            # Standardized client; WS + REST helpers

/src/
  do/RoomDO.ts         # Durable Object: hibernatable WebSocket room(s)
  schemas/apiSchemas.ts# Zod schemas for requests/responses/errors
  utils/openapi.ts     # OpenAPI 3.1.0 runtime generator (json+yaml)
  utils/ws.ts          # WS helpers (broadcast, frame, retry)
  utils/ai.ts          # Workers AI helpers for diagnostics & fixes
  utils/db.ts          # Kysely + Drizzle setup for D1
  tests/runner.ts      # Test orchestrator (on-demand + cron)
  tests/defs.ts        # Programmatic default tests (seed if table empty)
  router.ts            # Hono REST routes + health/test APIs
  rpc.ts               # RPC registry + dispatcher
  mcp.ts               # MCP: list tools + execute tool (mirrors RPC)
  types.ts             # Env & shared types
  index.ts             # Entry: routes, /openapi, /ws, assets

/wrangler.jsonc        # Config with assets binding, DO, cron, etc.
/migrations/0001_init.sql  # D1 schema for tests & results

/tests/examples.md     # curl & WS usage; run-tests examples
```

---

## Functional Requirements

### A) Frontend (Vibe Engineer microsite aesthetic)
- **Landing `/index.html`**: gradient hero, scroll animations, narrative structure:
  - Hero (headline, subhead, CTA: *Explore System*, *View API Spec*), optional live metrics bar.
  - The Challenge, The Solution, Feature Cards, Metrics/Impact, Use Cases, Roadmap, CTA/Footer.
  - Use **Tailwind (CDN)**, fonts `Inter` or `Manrope`, color palette (Primary Indigo `#4f46e5`, Secondary Emerald `#10b981`, Slate/Stone neutrals).
  - Sticky glass **nav** from `nav.html`; section highlighting.
  - IntersectionObserver **fade-in-up** animations.
- **Health `/health.html`**:
  - **HeroUI** components (cards, badges, progress) via CDN or unpkg.
  - List **active tests** (from D1). Show description and **spinner** during run.
  - Button **“Run Health Tests”** to trigger on-demand `/api/tests/run` and live-update per-test status.
  - Table of **latest session** results with pass/fail, duration, links to raw/logs and **AI analysis**.
  - Error dictionary tooltip: meaning + suggested fix (from test defs).

### B) API Surfaces
- **WebSocket (default)** at `/ws?room=:id` → handled by **RoomDO** using hibernatable API. Broadcast `{type,payload,meta}` to all peers; WS reconnect/retry in `client.js`.
- **REST fallback** under `/api/*` (Hono). Must provide endpoints for tasks/analysis **and** test orchestration:
  - `POST /api/tests/run` → run all active tests (new `session_uuid`), returns immediate session stub; streaming or polling via `GET /api/tests/session/:id`.
  - `GET /api/tests/defs` → active test definitions
  - `GET /api/tests/latest` → last session summary (+ link to details)
  - `GET /api/health` → summarized health snapshot for landing metrics bar
  - Example business APIs (e.g., `/api/tasks`, `/api/analyze`) using shared Zod schemas.
- **RPC**: `POST /rpc` accepts `{ method, params }` and dispatches to **rpcRegistry**; same handlers as REST/WS/MCP.
- **MCP**:
  - `GET /mcp/tools` → derive tools from rpcRegistry + Zod schema metadata.
  - `POST /mcp/execute` `{ tool, params }` → dispatch to rpcRegistry.

### C) OpenAPI 3.1.0 (ChatGPT Custom Action ready)
- Dynamic at runtime using **@asteasolutions/zod-to-openapi**.
- Serve at:
  - `GET /openapi.json` (application/json)
  - `GET /openapi.yaml` (application/yaml)
- Include: `openapi: "3.1.0"`, `jsonSchemaDialect`, `info`, `servers`, `tags`, `components`, **operationId** per route, `summary`, `description`, examples, error schemas, standard envelope.
- Auto-derive from Zod definitions; ensure both JSON & YAML variants.

### D) Health, Testing, and Self-Healing
- **D1 schema** (see migration below):
  - `test_defs` — id (uuid), name, description, is_active int (1/0), category, severity, error_map JSON (error_code→ {meaning, fix}), created_at
  - `test_results` — id (uuid), session_uuid, test_fk (uuid), started_at, finished_at, duration_ms, status ("pass"|"fail"), raw JSON, error_code, ai_prompt_to_fix_error TEXT, ai_human_readable_error_description TEXT
  - Indexes on `session_uuid`, `test_fk`, `finished_at`.
- **Kysely + Drizzle** for D1 access:
  - Provide both: Kysely for query builder ergonomics; Drizzle for migrations/types.
  - `utils/db.ts` exports clients for both, reusing the same binding.
- **Test runner**:
  - Loads **active** tests from `test_defs`. If empty, **seed** from `/src/tests/defs.ts`.
  - Runs tests **in parallel with limits** (e.g., 3–5 concurrency). Each test returns raw payload, error_code (if any), and pass/fail.
  - Writes each row to `test_results` with a shared `session_uuid` and measured duration.
  - After each failure, call **Workers AI** (`env.AI.run`) to produce:
    - `ai_human_readable_error_description`
    - `ai_prompt_to_fix_error` (actionable steps)
    - Optionally **attempt auto-remediation** (safe operations only; e.g., warming cache, retrying upstream, toggling feature flag via KV), and append a remediation note to `raw` JSON.
- **Cron + On-demand**:
  - Schedule a cron (e.g., every 15 minutes) to call `tests/runner.ts`.
  - Also expose `POST /api/tests/run` to trigger a new session on demand; return a session id and stream or poll for results.

### E) Security & Ops
- Security headers (CSP loose enough for Tailwind CDN + HeroUI + inline animations), `X-Content-Type-Options`, `Referrer-Policy`, etc.
- CORS only for `/api/*` with allowlist and `OPTIONS` preflights.
- Typed errors and consistent JSON error envelope.
- Observability: structured logs, request ids; `observability.enabled=true`.

---

## Code Expectations (high-level)
You must generate **complete files** that build with:
```bash
npm i hono zod @asteasolutions/zod-to-openapi kysely drizzle-orm
npx wrangler dev
```
(If you choose YAML output, also add a tiny `yaml` dependency; if not, explain how to add it.)

Implementations MUST:
- Import all used types/functions.
- Use ES Modules format only.
- Use the Durable Objects **hibernatable** WS API in RoomDO (`this.ctx.acceptWebSocket(server)` + `webSocketMessage/Close/Error`).
- Validate inputs with Zod on every API accepting JSON.
- Share the **same rpcRegistry** across REST/WS/MCP.
- Include minimal **example business APIs** and tests to prove the wiring.

---

## Required Snippets to Produce (inline in your output)

### 1) `wrangler.jsonc` with Assets Binding & Cron
```jsonc
{
  "name": "vibe-app",
  "main": "src/index.ts",
  "compatibility_date": "2025-03-07",
  "compatibility_flags": ["nodejs_compat"],
  "observability": { "enabled": true, "head_sampling_rate": 1 },
  "assets": { "directory": "./public", "binding": "ASSETS", "not_found_handling": "single-page-application" },
  "durable_objects": { "bindings": [{ "name": "ROOM_DO", "class_name": "RoomDO" }] },
  "migrations": [{ "tag": "v1", "new_classes": ["RoomDO"] }],
  "d1_databases": [{ "binding": "DB", "database_name": "vibe-db", "database_id": "<set-after-create>" }],
  "triggers": { "crons": ["*/15 * * * *"] }
}
```

### 2) Serving Static Assets & API in `src/index.ts`
- If path starts with `/api/`, `/openapi.json`, `/openapi.yaml`, `/ws`, or `/mcp/*`, handle in code.
- Otherwise, delegate to `env.ASSETS.fetch(request)`. Include health `/health.html` route convenience.

### 3) OpenAPI Runtime Generator
Provide `utils/openapi.ts` that uses `OpenAPIRegistry` + `OpenApiGeneratorV31` to build **3.1.0** with `operationId`, examples, and `jsonSchemaDialect`.

### 4) Durable Object (RoomDO) Hibernatable WS
Show `RoomDO.ts` skeleton with `this.ctx.acceptWebSocket(server)`, `webSocketMessage`, `webSocketClose`, `webSocketError`.

### 5) D1 Schema Migration (`/migrations/0001_init.sql`)
```sql
CREATE TABLE IF NOT EXISTS test_defs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  severity TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  error_map TEXT, -- JSON string of { code: { meaning, fix } }
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS test_results (
  id TEXT PRIMARY KEY,
  session_uuid TEXT NOT NULL,
  test_fk TEXT NOT NULL REFERENCES test_defs(id),
  started_at TEXT NOT NULL,
  finished_at TEXT,
  duration_ms INTEGER,
  status TEXT NOT NULL CHECK (status IN ('pass','fail')),
  error_code TEXT,
  raw TEXT, -- JSON
  ai_human_readable_error_description TEXT,
  ai_prompt_to_fix_error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_results_session ON test_results(session_uuid);
CREATE INDEX IF NOT EXISTS idx_results_testfk ON test_results(test_fk);
CREATE INDEX IF NOT EXISTS idx_results_finished ON test_results(finished_at);
```

### 6) Kysely + Drizzle Setup (`utils/db.ts`)
- Export a Kysely client and Drizzle client wired to the same `env.DB` binding.
- Provide helpers `insertTestResult`, `getLatestSession`, `listActiveTests`.

### 7) Test Runner (`tests/runner.ts`)
- Accept `session_uuid` (or generate).
- Pull **active** tests from `test_defs` (seed from `tests/defs.ts` if empty).
- Run tests (concurrency limited), write rows to `test_results`.
- For failures, call **Workers AI** (`env.AI.run`) to produce readable desc + fix prompt; store results, and attempt safe remediation hooks.
- Expose `runAllTests(env)` so cron & `/api/tests/run` can reuse it.

### 8) REST: Health & Tests (`router.ts`)
- `GET /api/health` returns snapshot (uptime, last test session status).
- `POST /api/tests/run` → starts run, returns `session_uuid`.
- `GET /api/tests/session/:id` → detailed session results.
- `GET /api/tests/defs` → list active test definitions.

### 9) Frontend
- `public/nav.html` includes sticky glass nav with section anchors.
- `public/styles.css` defines Tailwind layers and custom utilities.
- `public/client.js` standardizes fetch/WS; implements “Run Health Tests” UI flow and per-test spinner updates via polling or WS events.
- `public/health.html` (HeroUI) consumes `/api/tests/defs`, displays the list, runs on-demand, and renders results.

---

## Non-Functional Requirements
- ES module only. Import everything used. No native/FFI deps.
- Security headers + CORS for `/api/*`.
- Minimal yet realistic example tests (e.g., hitting `/` health, `/openapi.json` presence, WS room handshake).

---

## Example Usage
> “Analyze this: https://core-task-manager-api.colby.workers.dev and generate the complete project per the spec above. Include the landing & health frontends, D1 schema & data access (Kysely + Drizzle), OpenAPI runtime, WS DO, RPC + MCP endpoints, cron-based test runner with Workers AI analysis, and all files and code blocks exactly as listed.”

---

## Final Acceptance
- `/openapi.json` & `/openapi.yaml` are valid 3.1.0 with `operationId` and Zod-derived schemas.
- `/ws` works via Durable Object (hibernatable).
- `/api/tests/run` triggers a run; `/api/tests/session/:id` shows results; `/api/health` summarizes status.
- `public/health.html` shows live test progress and latest session results; uses HeroUI components.
- D1 writes are visible; AI fields populated on failures.
- Cron triggers tests every 15m.
- Assets served via `ASSETS` binding; landing & health pages load with shared nav/styles/client.
