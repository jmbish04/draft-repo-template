
import { ExpertAgent } from "./agents/team/expert.js";
import { getDb } from "./db/logger.js";
import { BrowserService } from "./tools/cloudflare-mcp/browser-render/index.js";
// @ts-ignore
import { getSandbox } from "@cloudflare/sandbox";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { JulesClient, JulesActivityService } from "./tools/jules";
import { ArchitectAgent } from "./agents/team/architect.js";
import { OverseerAgent } from "./agents/team/overseer.js";
import { QAAgent } from "./agents/team/qa.js";
import { JulesMonitorService } from "./services/jules-monitor";
import app from "./server.js";
import { HealthCheckers } from "./tools/health";
import { Env } from "./types";

// Initialize the MCP Transport (Global state for worker lifetime)
const transport = new WebStandardStreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
});

export default {
  /**
   * Cron Orchestration: Health checks + Jules monitoring
   */
  async scheduled(event: ScheduledEvent, env: any, ctx: ExecutionContext) {
    const cronName = event.cron;

    // Jules Monitor runs on the 5-minute schedule
    if (cronName === "*/5 * * * *") {
      try {
        const monitor = new JulesMonitorService(env);
        console.log("🕒 Cron: Starting Jules Monitor Sync...");
        const result = await monitor.run();
        console.log(`🕒 Cron: Jules Monitor Complete - Synced: ${result.synced}, Checked: ${result.checked}, Interventions: ${result.interventions}`);
      } catch (error) {
        console.error("Jules Monitor error:", error);
      }
      return;
    }

    // Health checks run on other schedules
    const db = getDb(env);
    const services = [
      { name: "D1 Database", check: async () => { await db.session.count(); } },
      {
        name: "Workers AI", check: async () => {
          // Simple "hello" prompt to verify model access
          await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
            messages: [{ role: 'user', content: 'hello' }]
          });
        }
      },
      {
        name: "Sandbox SDK", check: async () => {
          // Ensure binding exists
          if (!env.SANDBOX) throw new Error("SANDBOX binding missing");
          const s = getSandbox(env.SANDBOX, "health-check");
          await s.exec("echo 1");
        }
      },
      {
        name: "Browser API", check: async () => {
          const b = new BrowserService(env);
          // Just check if service config is present, don't necessarily call external API if secrets missing
          const health = await b.checkHealth();
          if (health.status !== 'OK') throw new Error(`Browser Service Not Configured: ${JSON.stringify(health.checks)} `);
        }
      },
      {
        name: "KV/Cache", check: async () => {
          // Check for either CACHE or KV binding
          if (env.CACHE) await env.CACHE.put("health_check", "ok");
          else if (env.KV) await env.KV.put("health_check", "ok");
          else throw new Error("No KV (binding: KV) or Cache (binding: CACHE) found");
        }
      }
    ];

    const results = [];

    for (const service of services) {
      const start = Date.now();
      let status = "OK";
      let details = "";
      try {
        await service.check();
      } catch (e: any) {
        status = "FAIL";
        details = e.message || String(e);
      }

      const duration = Date.now() - start;
      const result = {
        serviceName: service.name,
        status,
        latency: duration,
        details
      };
      results.push(result);

      try {
        await db.healthCheck.create({ data: result });
      } catch (dbError) {
        console.error(`Failed to persist health check for ${service.name}: `, dbError);
      }
    }

    return results;
  },

  async queue(batch: MessageBatch<any>, env: any): Promise<void> {
    // Route to appropriate workflow based on queue name
    // Note: MessageBatch.queue is the queue name, not the binding name

    switch (batch.queue) {
      case "jules-mcp-ingest":
        if (env.INGEST_WORKFLOW) {
          await env.INGEST_WORKFLOW.create({ params: batch.messages });
        }
        break;
      case "jules-mcp-webhook":
        if (env.WEBHOOK_WORKFLOW) {
          await env.WEBHOOK_WORKFLOW.create({ params: batch.messages });
        }
        break;
      case "jules-mcp-advisor":
        if (env.ADVISOR_WORKFLOW) {
          await env.ADVISOR_WORKFLOW.create({ params: batch.messages });
        }
        break;
      default:
        console.warn(`Unknown queue: ${batch.queue} `);
    }
  },

  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // MCP Streamable Bridge
    if (url.pathname === "/mcp") {
      return transport.handleRequest(request);
    }

    // Health Monitoring API
    if (url.pathname === "/api/health") {
      const db = getDb(env);
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const latestChecks = await db.healthCheck.findMany({
        orderBy: { timestamp: 'desc' },
        take: limit
      });
      return Response.json(latestChecks);
    }

    // Live Diagnostics
    if (url.pathname === "/api/health/run" && request.method === "POST") {
      const results = await this.scheduled({} as any, env, ctx);
      return Response.json({ success: true, message: "Diagnostic run completed.", results });
    }

    // WebSocket Health Stream
    if (url.pathname === "/api/health/stream") {
      const upgradeHeader = request.headers.get("Upgrade");
      if (!upgradeHeader || upgradeHeader !== "websocket") {
        return new Response("Expected Upgrade: websocket", { status: 426 });
      }

      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      server.accept();

      // Start streaming health checks
      ctx.waitUntil((async () => {
        try {
          // Send initial metadata
          server.send(JSON.stringify({ type: "START", total: HealthCheckers.length }));

          for (const checker of HealthCheckers) {
            server.send(JSON.stringify({ type: "TEST_START", name: checker.name }));
            const start = Date.now();
            try {
              const res = await checker.check(env);
              const latency = Date.now() - start;

              // Handle both single result and array of results (some checkers return HealthResult, some might wrap)
              // The types say checkHealth returns Promise<HealthResult> but let's be safe.
              // Actually types.ts says HealthResult, but some implementations might check multiple things? 
              // Looking at health.ts, `check` returns `Promise<HealthResult>`.
              // But wait, the previous code was `Promise<HealthResult[]>`.
              // Ah, `Promise.all` returns array of results. Each `check` returns `HealthResult`.

              // @ts-ignore
              let status = res.status || (res.success ? "OK" : "FAILURE"); // Adapt to potential result variance

              server.send(JSON.stringify({
                type: "TEST_RESULT",
                name: checker.name,
                status: status,
                latency: latency,
                // @ts-ignore
                message: res.message || res.status
              }));
            } catch (err: any) {
              server.send(JSON.stringify({
                type: "TEST_RESULT",
                name: checker.name,
                status: "FAILURE",
                latency: Date.now() - start,
                message: err.message
              }));
            }
          }

          server.send(JSON.stringify({ type: "DONE" }));
          server.close();
        } catch (e) {
          console.error("WebSocket Stream Error", e);
          server.close();
        }
      })());

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }


    // Dashboard Data API
    if (url.pathname === "/api/dashboard/activity") {
      const db = getDb(env);
      const limit = parseInt(url.searchParams.get("limit") || "10");
      const julesClient = new JulesClient({ apiKey: env.JULES_API_KEY || '' });
      const activityService = new JulesActivityService(julesClient, db, env);
      try {
        const activity = await activityService.getUnifiedRecentActivity(limit);
        return Response.json(activity);
      } catch (e) {
        return Response.json([]);
      }
    }

    // Dashboard Stats API (Cached via DO)
    if (url.pathname === "/api/dashboard/stats") {
      const id = env.DASHBOARD_AGENT.idFromName("global");
      const stub = env.DASHBOARD_AGENT.get(id);
      return stub.fetch(request);
    }



    // --- Multi-Agent Orchestration ---
    // Route: /api/orchestrator/new-project
    if (url.pathname === "/api/orchestrator/new-project" && request.method === "POST") {
      const body = await request.json() as { prompt: string };
      const id = env.EXPERT_AGENT.idFromName("architect"); // Using existing binding, aliased conceptually
      const stub = env.EXPERT_AGENT.get(id);
      // We might need to implement a 'exec' method on the stub or pass via fetch
      // For now, assuming standard DO fetch pattern if we migrated agents to DOs, 
      // OR simply running the class logic directly if they are stateless logic.
      // The Prompt implies "Agents" as classes. Let's instantiate directly for now to keep it simple,
      // or route if they are strict DOs. 
      // Given existing code used 'get(id).fetch', let's stick to simple direct execution for this refactor 
      // unless strictly bound.
      // The user prompt asked to "Refactor... into specialized agents".
      // Let's treat them as logic classes invoked here for simplicity, OR use DOs if we must persistence.
      // We'll run them ephemeral for "Architect" (stateless task) and "QA".
      // "Overseer" definitely needs DO or Cron.

      const architect = new ArchitectAgent(env, {} as any); // State mock
      // We need a fake connection for 'onMessage' or a direct method.
      // Let's call the logic directly.
      await architect.onMessage({ send: () => { } }, body.prompt);
      return Response.json({ status: "Architect started" });
    }

    // Route: /api/orchestrator/qa
    if (url.pathname === "/api/orchestrator/qa" && request.method === "POST") {
      const body = await request.json() as { repoName: string, sessionId: string };
      const qa = new QAAgent(env, {} as any);
      ctx.waitUntil(qa.review(body.repoName, body.sessionId));
      return Response.json({ status: "QA started background" });
    }

    // --- Chat API ---
    // Route: /api/agent/message
    // Route: /api/agent/message
    if (url.pathname === "/api/agent/message" && request.method === "POST") {
      // Determine which agent to talk to based on header
      const agentName = request.headers.get("X-Agent") || "ExpertAgent";

      let stub: DurableObjectStub;
      let id: DurableObjectId;

      switch (agentName) {
        case "OverseerAgent":
          id = env.OVERSEER_AGENT.idFromName("overseer");
          stub = env.OVERSEER_AGENT.get(id);
          break;
        case "ArchitectAgent":
          id = env.ARCHITECT_AGENT.idFromName("architect");
          stub = env.ARCHITECT_AGENT.get(id);
          break;
        case "ExpertAgent":
        default:
          id = env.EXPERT_AGENT.idFromName("jules");
          stub = env.EXPERT_AGENT.get(id);
          break;
      }

      try {
        return await stub.fetch(request);
      } catch (e: any) {
        console.error(`POST /api/agent/message [${agentName}] error`, JSON.stringify(e));
        return new Response(JSON.stringify({ error: e.message, stack: e.stack }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // Cloudflare Webhook Events
    if (url.pathname === "/webhooks/cloudflare-events" && request.method === "POST") {
      try {
        const event = await request.json();
        console.log("webhook event received:", JSON.stringify(event, null, 2));
        return Response.json({ success: true });
      } catch (e: any) {
        console.error("Webhook Error:", e);
        return Response.json({ success: false, error: e.message }, { status: 400 });
      }
    }

    // Sentinel API
    if (url.pathname === "/api/sentinel/check-pr" && request.method === "POST") {
      const body = await request.json();
      const id = env.SENTINEL_AGENT.idFromName("sentinel-global");
      const stub = env.SENTINEL_AGENT.get(id);

      // Transform to BaseCoreAgent task format
      const taskRequest = new Request("http://sentinel/task", {
        method: "POST",
        body: JSON.stringify({
          type: "check_pr",
          payload: body
        })
      });
      return await stub.fetch(taskRequest);
    }

    if (url.pathname === "/api/sentinel/scan-repo" && request.method === "POST") {
      const body = await request.json();
      const id = env.SENTINEL_AGENT.idFromName("sentinel-global");
      const stub = env.SENTINEL_AGENT.get(id);

      const taskRequest = new Request("http://sentinel/task", {
        method: "POST",
        body: JSON.stringify({
          type: "scan_repo",
          payload: body // { owner, repo }
        })
      });
      return await stub.fetch(taskRequest);
    }

    // Agent Routing -> Hono Middleware
    // Ensure we await the app.fetch result
    const response = await app.fetch(request, env, ctx);
    if (response.status !== 404) {
      return response;
    }

    // SPA Fallback: Serve index.html for unknown GET requests (except /api)
    // This allows React Router to handle /chat, /health, etc.
    if (request.method === "GET" && !url.pathname.startsWith("/api")) {
      // Try to fetch from assets via binding or default fetch (if using Assets binding implicit in workers)
      // Since we are in a Module worker with 'assets' config likely enabled or static assets:
      // Attempt to fetch standard asset. If 404, assume it's index.html

      // Note: In Cloudflare Workers with Assets, usually `env.ASSETS.fetch` is used.
      // Let's try to fetch the asset. If it fails (404), return index.html
      if (env.ASSETS) {
        const asset = await env.ASSETS.fetch(request);
        if (asset.status === 404) {
          return env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
        }
        return asset;
      }
    }

    return response;
  }
};

// Exports for Durable Objects (Maintaining references for bindings)
export { ExpertAgent } from "./agents/team/expert.js";
export { ArchitectAgent } from "./agents/team/architect.js";
export { OverseerAgent } from "./agents/team/overseer.js";
export { QAAgent } from "./agents/team/qa.js";
export { JudgeAgent } from "./agents/team/judge";
export { OrchestratorAgent } from "./agents/team/orchestrator";
// @ts-ignore
export { Sandbox } from "@cloudflare/sandbox";
export { JulesService } from "./rpc/jules-service";

// Exports for Workflows
export { AdvisorWorkflow, IngestWorkflow } from "./workflows/stubs";
export { VerificationAgent } from "./agents/workflow/verification";
export { DashboardAgent } from "./agents/core/dashboard";
export { SentinelAgent } from "./agents/team/sentinel";

