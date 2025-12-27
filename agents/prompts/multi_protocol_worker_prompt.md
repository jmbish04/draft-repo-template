# Prompt: Multi‑Protocol Cloudflare Worker (REST + WebSocket + RPC + MCP) with Dynamic OpenAPI 3.1.0

## Role
You are a senior Cloudflare Workers engineer. Produce **complete, production‑grade TypeScript** that upgrades an existing Worker into a **multi‑protocol service** exposing:
- **REST API** (fallback if WS/RPC is unavailable)
- **WebSocket API** (default for realtime)
- **RPC entry points** (invoked via **service bindings** from other Workers)
- **MCP server** endpoints (Model Context Protocol) that mirror the same commands

Deliver self‑contained code that compiles with `wrangler` and follows Cloudflare best practices.

---

## Objectives
1. Implement four interoperable entry points (REST, WS, RPC, MCP) over the **same command registry** so behavior stays in sync.
2. Generate **OpenAPI 3.1.0** at runtime from Zod schemas and serve it at:
   - `GET /openapi.json`
   - `GET /openapi.yaml`
3. WebSocket uses **Durable Objects WebSocket API** (hibernation). Provide a simple **room** for multi‑agent collaboration.
4. RPC interface callable directly through **service bindings** (e.g., `env.CORE.fetch()` / `.rpc()` pattern).
5. MCP endpoints expose the same commands as tools (list & execute).
6. Ship **secure defaults** (CORS where needed, security headers, validation, error handling).
7. Include **tests & usage examples** (curl for REST/MCP, sample WS client, sample RPC consumer Worker).

---

## Constraints & Standards
- **Language:** TypeScript (ES modules only; no legacy Service Worker format).
- **Typing:** Use `wrangler types`; add proper interfaces for `Env` and payloads.
- **Schema:** Define all input/output via **Zod** and generate OpenAPI 3.1.0 via `zod-to-openapi`.
- **OpenAPI 3.1.0 compliance:** Correct JSON Schema draft, info block, servers, tags, components, examples, error shapes.
- **WebSocket in DO:** MUST use the **hibernatable** WebSocket API: `this.ctx.acceptWebSocket(server)`, implement `webSocketMessage`, `webSocketClose`, `webSocketError` (no legacy event listeners).
- **RPC:** Expose an RPC dispatcher that maps `{ method, params }` to handlers from a shared `rpcRegistry`. Handlers must be re‑used across REST/WS/MCP.
- **MCP:** Provide endpoints:
  - `GET /mcp/tools` (list tools)
  - `POST /mcp/execute` (JSON‑RPC style: `{ tool, params }`)
  - `GET /mcp/schema` (optional; tool schema bundle)
- **Security:** Validate all input; sanitize output; set security headers; CORS opt‑in for `/api/*` only.
- **Observability:** Minimal structured logs; appropriate HTTP status codes; consistent error envelope.
- **Dependencies:** Minimize deps. Use official Cloudflare packages where appropriate; do not add native/FFI deps.
- **Performance:** Stream responses when helpful; avoid unnecessary await/JSON copies; keep cold start low.
- **Files:** Provide **full files**, not diffs. Keep code **compilable**.

---

## Output Deliverables
**Produce these files exactly** (create content for each):

1) `src/index.ts` — main router and dispatch:
   - Routes:
     - `GET /` health
     - `GET /openapi.json` (runtime generated)
     - `GET /openapi.yaml` (runtime generated)
     - `GET /ws` (upgrades to WS; delegates to DO room by `projectId`/query)
     - `POST /rpc` (HTTP RPC surface for convenience; primarily for testing)
     - `ALL /api/*` (REST; Hono recommended)
     - `ALL /mcp/*` (MCP endpoints)
   - Uses `Hono` for REST + middleware (CORS for `/api/*`, JSON error handling).

2) `src/rpc.ts` — shared command registry + dispatcher:
   - `export const rpcRegistry = { createTask, listTasks, runAnalysis, … }`
   - `export async function dispatchRPC(method: string, params: unknown, env: Env, ctx: ExecutionContext)`
   - Commands must be Zod‑validated; return typed results; throw typed errors.

3) `src/mcp.ts` — MCP adapter:
   - `GET /mcp/tools` returns `{ tools: [{ name, description, schema }...] }`
   - `POST /mcp/execute` expects `{ tool, params }`
   - Marshals to/from `rpcRegistry` + Zod schemas.

4) `src/router.ts` — REST routes (Hono):
   - `POST /api/tasks` → `createTask`
   - `GET /api/tasks` → `listTasks`
   - `POST /api/analyze` → `runAnalysis`
   - Include consistent error envelope: `{ success: false, error, details? }`

5) `src/do/RoomDO.ts` — Durable Object for WS hibernation:
   - Accepts WS via `this.ctx.acceptWebSocket(server)`
   - Tracks connections; broadcasts events `{"type": "...","payload":{...},"meta":{...}}`
   - Optional `projectId` multiplexing (one DO per id).

6) `src/schemas/apiSchemas.ts` — Zod types for requests/responses + errors:
   - Example entities: `Task`, `CreateTaskRequest`, `CreateTaskResponse`, `ErrorResponse`, etc.
   - Use `.openapi({ example })` metadata where helpful.

7) `src/utils/openapi.ts` — build OpenAPI 3.1.0 at runtime:
   - `buildOpenAPIDocument(baseUrl: string)` returns a full 3.1.0 doc using `zod-to-openapi`.
   - Include `components.schemas` and paths for REST endpoints with request/response schemas.

8) `src/utils/ws.ts` — small helpers for WS broadcast & JSON framing.

9) `src/types.ts` — `Env` typing including bindings (DO, KV if used).

10) `wrangler.jsonc` — config:
    - `"compatibility_date": "2025-03-07"`
    - `"compatibility_flags": ["nodejs_compat"]`
    - `observability.enabled = true`, `head_sampling_rate = 1`
    - DO binding for `RoomDO`; `migrations` with `new_classes`/`new_sqlite_classes` as required.
    - Only include bindings you actually use.

11) `tests/examples.md` — runnable examples:
    - curl for REST & MCP
    - WS sample (browser + Node) to connect and send JSON
    - RPC sample (another Worker snippet) using a `service` binding

---

## Acceptance Criteria
- **OpenAPI 3.1.0** validates (JSON/YAML) and accurately reflects routes, params, bodies, and error responses.
- **WS** accepts, broadcasts, and resumes after idle (hibernation). No legacy `addEventListener` usage in DO.
- **RPC** methods callable locally over HTTP and from another Worker via **service binding**.
- **MCP** lists tools and executes them against the same registry & schemas as REST/RPC/WS.
- **/openapi.json** and **/openapi.yaml** are generated **dynamically** at request time from Zod.
- Code compiles with `wrangler dev` and deploys without additional edits.

---

## Repository Scaffold (create exactly)
```
src/
  do/
    RoomDO.ts
  schemas/
    apiSchemas.ts
  utils/
    openapi.ts
    ws.ts
  rpc.ts
  mcp.ts
  router.ts
  types.ts
  index.ts
wrangler.jsonc
tests/
  examples.md
```

---

## Implementation Notes (must follow)

### Routing (Hono)
- Mount `router` under `/api/*` and MCP handlers under `/mcp/*`.
- Provide `GET /` health with version & timestamp.
- Provide `GET /openapi.json` and `GET /openapi.yaml`, both built from the same Zod registry.

### OpenAPI Generation
- Use `zod-to-openapi` to create `components.schemas` and path ops.
- Mark errors with a shared `ErrorResponse` and reference with `$ref`.
- Ensure `openapi: "3.1.0"` and include `jsonSchemaDialect` per spec.
- Inject `servers` based on `baseUrl` derived from request.

### Durable Object WebSocket
- Create a `RoomDO` that uses `this.ctx.acceptWebSocket(server)`.
- Implement `webSocketMessage`, `webSocketClose`, `webSocketError`.
- Keep an in‑memory map of sockets from `this.ctx.getWebSockets()` and broadcast helper in `utils/ws.ts`.
- Support `projectId` from URL search params or header to derive DO id.

### RPC via Service Binding
- Another Worker can bind to this one as `"CORE"` then call `env.CORE.fetch(new Request("https://.../rpc", {method:"POST", body}))`.
- Optional: expose a **convenience** RPC helper exported from `src/rpc.ts` for consumers.

### MCP
- `GET /mcp/tools` returns the list of tools derived from `rpcRegistry` + Zod shape.
- `POST /mcp/execute` validates `{ tool, params }` and dispatches to the registry.
- Keep responses simple and JSON‑RPC‑style: `{ success: true, result } | { success: false, error }`.

### Security
- CORS enabled only for `/api/*` (configurable allowlist).
- Add standard security headers to all responses.
- Validate all request bodies with Zod; return 400s with clear details.
- Avoid echoing untrusted strings without sanitization.

### Observability
- Log method, path, request id; log structured errors with codes.
- Return stable error shapes for clients and MCP tools.

---

## Minimal Code Scaffolding (show working patterns)

### 1) `src/types.ts`
```ts
export interface Env {
  ROOM_DO: DurableObjectNamespace;
}
export type RPCMethod = "createTask" | "listTasks" | "runAnalysis";
```

### 2) `src/schemas/apiSchemas.ts`
```ts
import { z } from "zod";

export const Task = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  status: z.enum(["pending", "running", "done"]).default("pending"),
  createdAt: z.string(),
});

export const CreateTaskRequest = z.object({
  title: z.string().min(1),
});

export const CreateTaskResponse = z.object({
  success: z.literal(true),
  task: Task,
});

export const ListTasksResponse = z.object({
  success: z.literal(true),
  tasks: z.array(Task),
});

export const AnalysisRequest = z.object({
  taskId: z.string().uuid(),
  depth: z.number().int().min(1).max(5).default(1),
});

export const AnalysisResponse = z.object({
  success: z.literal(true),
  report: z.object({
    taskId: z.string().uuid(),
    score: z.number(),
    notes: z.string(),
  }),
});

export const ErrorResponse = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.any().optional(),
});

export type TCreateTaskRequest = z.infer<typeof CreateTaskRequest>;
```

### 3) `src/utils/openapi.ts`
```ts
import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import * as S from "../schemas/apiSchemas";

export function buildOpenAPIDocument(baseUrl: string) {
  const registry = new OpenAPIRegistry();

  // Register schemas
  registry.register("Task", S.Task);
  registry.register("CreateTaskRequest", S.CreateTaskRequest);
  registry.register("CreateTaskResponse", S.CreateTaskResponse);
  registry.register("ListTasksResponse", S.ListTasksResponse);
  registry.register("AnalysisRequest", S.AnalysisRequest);
  registry.register("AnalysisResponse", S.AnalysisResponse);
  registry.register("ErrorResponse", S.ErrorResponse);

  // Paths
  registry.registerPath({
    method: "post",
    path: "/api/tasks",
    summary: "Create a task",
    request: { body: { content: { "application/json": { schema: S.CreateTaskRequest } } } },
    responses: {
      200: { description: "OK", content: { "application/json": { schema: S.CreateTaskResponse } } },
      400: { description: "Bad Request", content: { "application/json": { schema: S.ErrorResponse } } },
    },
    tags: ["Tasks"],
  });

  registry.registerPath({
    method: "get",
    path: "/api/tasks",
    summary: "List tasks",
    responses: {
      200: { description: "OK", content: { "application/json": { schema: S.ListTasksResponse } } },
    },
    tags: ["Tasks"],
  });

  registry.registerPath({
    method: "post",
    path: "/api/analyze",
    summary: "Run analysis",
    request: { body: { content: { "application/json": { schema: S.AnalysisRequest } } } },
    responses: {
      200: { description: "OK", content: { "application/json": { schema: S.AnalysisResponse } } },
      400: { description: "Bad Request", content: { "application/json": { schema: S.ErrorResponse } } },
    },
    tags: ["Analysis"],
  });

  const generator = new OpenApiGeneratorV31(registry.definitions);
  const doc = generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Multi-Protocol Worker API",
      version: "1.0.0",
      description: "REST + WS + RPC + MCP",
    },
    servers: [{ url: baseUrl }],
    jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
    tags: [{ name: "Tasks" }, { name: "Analysis" }],
  });

  return doc;
}
```

### 4) `src/do/RoomDO.ts` (WS DO, hibernation pattern)
```ts
import { DurableObject } from "cloudflare:workers";

export class RoomDO extends DurableObject {
  // Accept WS using the hibernatable API
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const text = typeof message === "string" ? message : new TextDecoder().decode(message);
    for (const sock of this.ctx.getWebSockets()) {
      if (sock !== ws) sock.send(text);
    }
  }
  async webSocketClose(ws: WebSocket, code: number) {
    try { ws.close(code, "closing"); } catch {}
  }
  async webSocketError(ws: WebSocket, err: unknown) {
    console.error("WS error", err);
    try { ws.close(1011, "error"); } catch {}
  }
}
```

### 5) `src/rpc.ts`
```ts
import { z } from "zod";
import * as S from "./schemas/apiSchemas";
import type { Env, RPCMethod } from "./types";

const createTask = async (params: unknown) => {
  const input = S.CreateTaskRequest.parse(params);
  const task = {
    id: crypto.randomUUID(),
    title: input.title,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  return { success: true as const, task };
};

const listTasks = async () => {
  return { success: true as const, tasks: [] };
};

const runAnalysis = async (params: unknown) => {
  const input = S.AnalysisRequest.parse(params);
  return { success: true as const, report: { taskId: input.taskId, score: 0.82, notes: "ok" } };
};

export const rpcRegistry: Record<RPCMethod, (p: unknown, env: Env, ctx: ExecutionContext) => Promise<unknown>> = {
  createTask: async (p, env, ctx) => createTask(p),
  listTasks: async (p, env, ctx) => listTasks(),
  runAnalysis: async (p, env, ctx) => runAnalysis(p),
};

export async function dispatchRPC(method: string, params: unknown, env: Env, ctx: ExecutionContext) {
  if (!(method in rpcRegistry)) throw new Error(`Unknown method: ${method}`);
  // @ts-expect-error runtime check above
  return await rpcRegistry[method](params, env, ctx);
}
```

### 6) `src/mcp.ts`
```ts
import { z } from "zod";
import * as S from "./schemas/apiSchemas";
import { dispatchRPC, rpcRegistry } from "./rpc";
import type { Env } from "./types";

const ExecuteBody = z.object({ tool: z.string(), params: z.any() });

export function mcpRoutes() {
  return {
    tools: async () => {
      const tools = Object.keys(rpcRegistry).map((name) => ({
        name,
        description: `Tool for ${name}`,
      }));
      return { tools };
    },
    execute: async (env: Env, ctx: ExecutionContext, body: unknown) => {
      const { tool, params } = ExecuteBody.parse(body);
      const result = await dispatchRPC(tool, params, env, ctx);
      return { success: true, result };
    },
  };
}
```

### 7) `src/router.ts`
```ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import * as S from "./schemas/apiSchemas";
import { dispatchRPC } from "./rpc";
import type { Env } from "./types";

export function buildRouter() {
  const app = new Hono<{ Bindings: Env }>();

  app.use("/api/*", cors());

  app.get("/", (c) => c.json({ ok: true, ts: new Date().toISOString(), version: "1.0.0" }));

  app.post("/api/tasks", async (c) => {
    const body = await c.req.json();
    const res = await dispatchRPC("createTask", body, c.env, c.executionCtx);
    return c.json(res);
  });

  app.get("/api/tasks", async (c) => {
    const res = await dispatchRPC("listTasks", null, c.env, c.executionCtx);
    return c.json(res);
  });

  app.post("/api/analyze", async (c) => {
    const body = await c.req.json();
    const res = await dispatchRPC("runAnalysis", body, c.env, c.executionCtx);
    return c.json(res);
  });

  app.post("/rpc", async (c) => {
    const { method, params } = await c.req.json();
    try {
      const result = await dispatchRPC(method, params, c.env, c.executionCtx);
      return c.json({ success: true, result });
    } catch (e: any) {
      return c.json({ success: false, error: e?.message ?? "RPC error" }, 400);
    }
  });

  return app;
}
```

### 8) `src/index.ts`
```ts
import { buildRouter } from "./router";
import { RoomDO } from "./do/RoomDO";
import { buildOpenAPIDocument } from "./utils/openapi";
import type { Env } from "./types";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/openapi.json") {
      const doc = buildOpenAPIDocument(`${url.origin}`);
      return Response.json(doc, { headers: { "content-type": "application/json" } });
    }
    if (url.pathname === "/openapi.yaml") {
      const doc = buildOpenAPIDocument(`${url.origin}`);
      const yaml = JSON.stringify(doc, null, 2) // replace with actual YAML if you wire "yaml" lib
        .replace(/"/g, ""); // placeholder to keep deps minimal in scaffold
      return new Response(yaml, { headers: { "content-type": "application/yaml" } });
    }

    if (url.pathname === "/ws" && request.headers.get("Upgrade") === "websocket") {
      const projectId = url.searchParams.get("projectId") ?? "default";
      const id = env.ROOM_DO.idFromName(projectId);
      const stub = env.ROOM_DO.get(id);
      return stub.fetch(request);
    }

    // MCP endpoints
    if (url.pathname.startsWith("/mcp/")) {
      const { mcpRoutes } = await import("./mcp");
      const routes = mcpRoutes();
      if (url.pathname === "/mcp/tools" && request.method === "GET") {
        return Response.json(await routes.tools());
      }
      if (url.pathname === "/mcp/execute" && request.method === "POST") {
        const body = await request.json();
        try {
          const res = await routes.execute(env, ctx, body);
          return Response.json(res);
        } catch (e: any) {
          return Response.json({ success: false, error: e?.message ?? "MCP error" }, { status: 400 });
        }
      }
      return new Response("Not found", { status: 404 });
    }

    // REST & RPC via Hono
    const app = buildRouter();
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;

export { RoomDO };
```

### 9) `wrangler.jsonc`
```jsonc
{
  "name": "multi-protocol-worker",
  "main": "src/index.ts",
  "compatibility_date": "2025-03-07",
  "compatibility_flags": ["nodejs_compat"],
  "observability": {
    "enabled": true,
    "head_sampling_rate": 1
  },
  "durable_objects": {
    "bindings": [
      { "name": "ROOM_DO", "class_name": "RoomDO" }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_classes": ["RoomDO"]
    }
  ]
}
```

### 10) `tests/examples.md` (usage snippets)
```bash
# REST
curl -sX POST $BASE/api/tasks   -H 'content-type: application/json'   -d '{"title":"demo"}' | jq

curl -s "$BASE/api/tasks" | jq

# MCP
curl -s "$BASE/mcp/tools" | jq
curl -sX POST "$BASE/mcp/execute"   -H 'content-type: application/json'   -d '{"tool":"runAnalysis","params":{"taskId":"00000000-0000-4000-8000-000000000000","depth":2}}' | jq

# RPC (HTTP harness)
curl -sX POST "$BASE/rpc"   -H 'content-type: application/json'   -d '{"method":"createTask","params":{"title":"fromRPC"}}' | jq

# WS (browser console)
const ws = new WebSocket(`${location.origin.replace('http','ws')}/ws?projectId=demo`);
ws.onmessage = e => console.log('msg', e.data);
ws.onopen = () => ws.send(JSON.stringify({ type: "ping", t: Date.now() }));
```

> Note: In production, replace the YAML placeholder with a proper YAML serializer (e.g., `yaml`). Keep dependencies minimal in this initial scaffold.

---

## Final Instructions
- Generate the full repository with files above and working TypeScript. 
- Ensure all imports exist; no unused bindings.
- Do not invent unsupported APIs. Use Cloudflare’s current Worker & DO APIs only.
- Everything should run with:
  ```bash
  npm i hono zod @asteasolutions/zod-to-openapi
  npx wrangler dev
  ```
- Confirm `/openapi.{json|yaml}`, REST endpoints, WS, RPC, and MCP all function.
