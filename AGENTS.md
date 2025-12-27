# AGENTS.md — AI Agents Architecture & Cloudflare Worker Development (Authoritative)

> **IMPORTANT:** When creating a Pull Request, ALWAYS use the `scripts/create-pull-request.sh` script.
> Usage: `./scripts/create-pull-request.sh "PR Title" "PR Body"`
> This script handles potential CLI errors and provides fallback commands.

This document is the **authoritative specification** for:

- AI agents running on a **Cloudflare Worker backend**
- General Cloudflare Worker development governance
- Type safety, build hygiene, and completion criteria

Any coding agent implementing or modifying:
- `src/services/agent.ts` or `src/agents/*`
- Durable Objects
- Queues
- Workflows
- Worker APIs
- Wrangler configuration
- Frontend behavior affected by backend changes

**must follow this document exactly.**

If code behavior conflicts with this document: **this document wins**.

---

## Package Manager Mandate

**Bun is mandatory** for all package management and scripts.

| Instead of | Use |
|-----------|-----|
| `npm install` | `bun install` |
| `npm run` | `bun run` |
| `npx` | `bunx` |

---

## 1. Core Architecture: Durable Objects

All AI agents are implemented using **Cloudflare Durable Objects (DOs)**.

### Why Durable Objects (Non-Negotiable)

- **Persistence**  
  Conversation history, task state, summaries, and artifacts are stored in DO transactional storage.
- **Identity**  
  Each agent instance has a deterministic, stable ID (e.g. Engagement ID, Session ID, Workflow run ID).
- **Edge Compute**  
  Agents run at the edge and invoke models directly via `env.AI`.

No other stateful mechanism may replace DOs for agent memory.

---

## 2. Base Agent Contract

There is exactly **one** valid base abstraction for agents.

### Canonical Base Class

- File: `src/services/agent.ts` (or legacy `src/agents/base.ts`)
- Name: `AI_Agent` / `BaseAgent`
- No parallel base classes are allowed.

### Required State

```ts
history: Array<{
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}>

config: {
  systemPrompt: string;
  model: string;
}
```

### Required Methods

- `chat(message: string): Promise<string>`
  - Executes the full ReAct loop (reason → act → observe → respond)
- `executeTool(toolName: string, args: unknown): Promise<unknown>`
  - Dynamic dispatcher for tool execution
- `clearMemory(): Promise<void>`
  - Clears persisted history and summaries
- (Optional legacy helpers)
  - `runReasoning(prompt: string)` → complex logic model
  - `runStructured(prompt: string, schema)` → schema-validated output

---

## 3. Models & Bindings

All inference must go through Workers AI (`env.AI`).

No direct HTTP calls, SDKs, or external inference services are allowed.

| Capability | Model | Binding |
|---|---|---|
| Reasoning / Chat | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | `env.AI` |
| Complex Logic | `@cf/openai/gpt-oss-120b` | `env.AI` |
| Embeddings | `@cf/baai/bge-base-en-v1.5` | `env.AI` |

---

## 4. Agent Personas

### 4.1 Forensic Classifier Agent

**Purpose**: Maps text segments to predefined forensic labels.

**System Prompt**:
> You are a Forensic Classifier.
> Rules:
> 1. Receive a list of text segments
> 2. Output JSON mapping ID → labels
> 3. Allowed labels: technical_claim, timeline_assertion, question_open, hostile_tone, procedural
> 4. No rewriting. No summarization.

**Capabilities**:
- `classify_batch(segments)` → structured JSON via schema enforcement

### 4.2 Forensic Analyst Agent

**Purpose**: Extracts objective facts and forensic signals from raw email content.

**System Prompt**:
> You are an expert digital forensics analyst. Extract hard facts, entities (People, Organizations, Locations), and assess sentiment and intent. Be precise. Output structured JSON when requested.

**Capabilities**:
- Sentiment analysis
- Observable extraction (IPs, URLs, crypto addresses via regex + LLM)

### 4.3 RAG Search Agent

**Purpose**: Answers questions using a private email corpus via Vectorize.

**System Prompt**:
> Use vector search before answering. Cite sources using email Subject and Date. If the answer is not present, say you do not know.

**Tools**:
- `vector_search(query: string)`
- `sql_lookup(query: string)` (read-only D1 metadata)

### 4.4 Health Monitor Agent

**Purpose**: Analyzes diagnostic and system health results.

**System Prompt**:
> Analyze system health logs. Identify critical failures, latency patterns, and likely root causes.

---

## 5. Tool Calling Rules (Strict)

Tool calling must follow this loop exactly:
1. Define tools as JSON schemas
2. Inject tool definitions into the system prompt
3. Parse explicit tool invocation from model output
4. Execute the tool in TypeScript
5. Inject results back as `{ role: "tool" }`
6. Resume model reasoning

No silent execution. No bypassing model intent.

---

## 6. Memory Management

- Persist memory via `this.state.storage`
- Enforce a rolling window (~20 messages)
- When exceeded:
  - Summarize older context
  - Replace with a single summary entry
  - Never silently drop context

---

## 7. Privacy & Isolation

- Never log raw email content or PII
- Isolate Engagement/User data via DO ID derivation
- Logs may include identifiers only, never content

---

# Cloudflare Worker Development Protocols (Project-Agnostic)

These rules apply to all Worker development, not just AI agents.

---

## 8. Project Structure & Separation of Concerns

**CRITICAL RULE**: Backend and frontend must remain strictly separated.
- `src/` → Backend only (Worker runtime)
- `frontend/` → Frontend only (React/Vite)

**Hard Directives**:
1. Never create `.tsx` / `.jsx` in `src/`
2. Never create backend logic in `frontend/`
3. Misplaced code must be moved immediately

---

## 9. Wrangler Types & Env Bindings (Single Source of Truth)

Full Reference: `AGENTS_WRANGLER_TYPES.md`

### Core Principle: The `Env` Interface is Immutable

The `Env` interface is **exclusively managed** by `wrangler types`.
- **❌ NEVER** create your own `Env` interface or type alias.
- **❌ NEVER** manually extend `Cloudflare.Env`.
- **❌ NEVER** import binding types manually from `@cloudflare/workers-types`.
- **❌ NEVER** cast `env` to `any` or a custom type.
- **❌ NEVER** manually edit `worker-configuration.d.ts` (it is auto-generated from `wrangler types`).
- **✅ ALWAYS** rely on the `Env` generated in `worker-configuration.d.ts`.

### Required Workflows

#### A. Managing Bindings (KV, D1, AI, etc.)
1. Add binding to `wrangler.jsonc`.
2. Run `bunx wrangler types`.
3. Use `env.BINDING_NAME` directly.

#### B. Managing Secrets & Variables
1. **Add the secret to `.dev.vars`**:
   - Format: `NEW_SECRET="value"`
   - **MUST** include a docstring/comment above it explaining its purpose.
   ```bash
   # API Key for Service X (Required for Feature Y)
   SERVICE_X_API_KEY="sk_live_..."
   ```
2. **Run `bunx wrangler types`**.
   - This parses `.dev.vars` and adds the secret to the `Env` interface automatically.
3. Use `env.SERVICE_X_API_KEY` directly in code.

#### `tsconfig.json` Requirement
```json
{
  "compilerOptions": {
    "types": ["./worker-configuration.d.ts"],
    "strict": true
  }
}
```

#### Correct Usage
```ts
export class MyAgent extends Agent<Env> {
  async execute() {
    await this.env.AI.run(...)
    await this.env.GMAIL_DB.prepare(...).all()
  }
}
```

#### Forbidden Patterns
- Custom Env interfaces
- Importing `Ai`, `D1Database`, etc. manually
- Casting `env`
- Using bindings not present in wrangler config

---

## 10. Database & Migrations (Hard Rules)

### 1) No SQL files — ever
- **Agents must never create, edit, or delete any `.sql` files**, including:
  - `migrations/*.sql`
  - any generated migration output
  - any ad-hoc SQL files used for schema changes
- Schema changes must be made **only** via **Prisma schema changes** (e.g. `prisma/schema.prisma`) and then generating migrations using Prisma.

### 2) ORM-only D1 access
- All database reads/writes must go through the **ORM layer (Prisma)**.
- **Raw SQL is forbidden**.
- **Rare exception:** complex, read-only queries (e.g. multi-join reporting queries) may use raw SQL **only** if:
  - The ORM cannot reasonably express the query, **and**
  - The SQL is **encapsulated in a single dedicated module**, **and**
  - The code includes a clear comment explaining why ORM isn’t sufficient, **and**
  - No SQL files are created/modified (the query must live in code).

### 3) Required package scripts (Prisma + D1 migrations)
Agents must ensure `package.json` includes scripts to:

- Generate Prisma client/types
- Create migrations from schema changes
- Apply migrations to D1 using the **binding name `DB`** (never the database name)

Required scripts (names are mandatory; commands may be adjusted to match repo layout):

```json
{
  "scripts": {
    "prisma:generate": "prisma generate",
    "prisma:migrate:dev": "prisma migrate dev",
    "db:migrate:local": "wrangler d1 migrations apply DB --local",
    "db:migrate:remote": "wrangler d1 migrations apply DB --remote",
    "build": "bun run build:worker",
    "deploy": "bun run prisma:generate && bun run db:migrate:remote && bun run build && wrangler deploy"
  }
}
```

- Default: Prisma ORM
- No raw SQL except rare, justified edge cases
- No manual editing of migration SQL
- No ad-hoc `wrangler d1 execute` for core flows

---

## 11. Async & Long-Running Work

Never block request handlers.

**Preferred pattern**:
1. API → validate → enqueue → return 202
2. Queue → trigger Workflow / DO
3. Workflow → orchestrate multi-step logic + persist artifacts

---

## 12. Frontend Synchronization Protocol

Every backend change requires explicit frontend impact assessment.

If user-visible behavior changes:
- Update UI
- Update API clients
- Update loading / error states

No hidden features.

---

## 13. Health & Reliability

Reliability is mandatory.
- Each domain exposes `checkHealth(env)`
- Health checks must test live behavior
- Changed behavior requires updated health coverage
- Failures must be structured and actionable

---

## 14. Mandatory Validation Protocol (Before Completion)

Before marking a turn complete, all must pass:
1. `bun run types`
2. `bun run lint` (or verified clean)
3. `bun run deploy --dry-run` (or equivalent)

Additionally:
- Run relevant health checks
- Fix all introduced failures

No exceptions.

---

## 15. Per-Turn Responsibilities (Every Change)

For every feature, fix, refactor, or config change:
1. Assess frontend impact
2. Update health modules if infra touched
3. Update README/docs if behavior changed
4. Verify scripts still work
5. Keep OpenAPI / specs in sync
6. Keep config and CI aligned
7. Update this document if protocols changed

---

## Final Rule

“Done” means:
- Wrangler types regenerated
- Lint clean
- Dry-run deploy passes
- Health checks pass
- Frontend, docs, scripts, and bindings are consistent

If code and this document disagree: **this document wins**.

---

## Appendix: Troubleshooting & Known Issues

### Zod Version Conflict (v3 vs v4)

*   **Issue**: Conflicting requirements between `@hono/zod-openapi` (relies on Zod v3 behaviors) and `ai` SDK (requires Zod v4 exports like `zod/v3` or `zod/v4`).
*   **Symptoms**: `Cannot read properties of undefined (reading 'parent')` or `Missing './v3' specifier in 'zod' package`.
*   **Resolution**:
    1.  **Strictly use `zod@^4.2.1`**: This version includes dual exports for v3 and v4 compatibility.
    2.  **Strict `z.record` Syntax**: Zod v4 requires explicit key and value types. Use `z.record(z.string(), z.any())` NOT `z.record(z.any())`.
    3.  **Do NOT use resolutions**: Use the compatible version instead of forcing incorrect versions via package.json resolutions.