import { Hono } from "hono";
// import { agentsMiddleware } from "hono-agents"; // Removed unused broken import
import { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

// 1. General Health Check
app.get("/health", (c) => c.json({ status: "OK", timestamp: new Date() }));

// 2. Register Agents Routing
// This handles: /agents/:agentNamespace/:agentName/*
// Example: /agents/EXPERT_AGENT/jules -> routes to EXPERT_AGENT DO with name "jules"
app.all("/agents/:namespace/:name/*", (c) => {
  const { namespace, name } = c.req.param();
  let binding = (c.env as any)[namespace];

  // Fallback: If literal binding not found, try converting kebab-case to UPPER_CASE (e.g. "expert-agent" -> "EXPERT_AGENT")
  if (!binding) {
    const upperName = namespace.toUpperCase().replace(/-/g, "_");
    binding = (c.env as any)[upperName];
  }

  if (!binding || typeof binding.idFromName !== "function") {
    return c.json({ error: `Namespace ${namespace} not found or not a Durable Object` }, 404);
  }

  const id = binding.idFromName(name);
  const stub = binding.get(id);

  // Create a new request with injected headers to satisfy Agent/PartyServer validation
  const headers = new Headers(c.req.raw.headers);
  headers.set("X-Agent-Namespace", namespace);
  headers.set("X-Agent-Name", name);
  const proxyRequest = new Request(c.req.raw, {
    headers
  });

  // Hand off to the Agent's fetch handler (supports WebSockets)
  return stub.fetch(proxyRequest);
});

export default app;
