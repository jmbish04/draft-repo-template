import { Env } from "../../types";
import { JulesClient } from "./client";
import { HealthResult } from "./types";

export async function checkHealth(env: Env): Promise<HealthResult> {
    const start = Date.now();
    const meta: Record<string, any> = {};

    // 1. Static Configuration & Binding Checks
    // Verifies that API keys and required Cloudflare Bindings (D1, Vectorize) are present.
    const missing: string[] = [];
    if (!env.JULES_API_KEY) missing.push("JULES_API_KEY");
    if (!env.DB) missing.push("DB (D1)");
    if (!env.JULES_MCP_VECTORIZE) missing.push("JULES_MCP_VECTORIZE");

    if (missing.length > 0) {
        return {
            status: 'FAILURE',
            message: `Configuration Error: Missing required bindings: ${missing.join(', ')}.`,
            latencyMs: Date.now() - start
        };
    }

    try {
        // 2. Jules API Connectivity Check
        // We request a single session to minimize data transfer while verifying auth/reachability.
        const client = new JulesClient({ apiKey: env.JULES_API_KEY });
        const response = await client.listSessions({ pageSize: 1 });
        
        const latency = Date.now() - start;

        // 3. Populate Meta Information
        meta.julesApi = {
            reachable: true,
            sessionsFound: response.sessions ? response.sessions.length : 0
        };
        
        meta.knowledge = {
            status: 'configured',
            bindings: ['DB', 'JULES_MCP_VECTORIZE']
        };

        return {
            status: 'OK',
            message: 'Jules API and Knowledge services are healthy.',
            latencyMs: latency,
            meta
        };

    } catch (error: any) {
        const latency = Date.now() - start;
        const errorMessage = error instanceof Error ? error.message : String(error);

        // 4. Intelligent Error Classification
        let status: HealthResult['status'] = 'FAILURE';
        let friendlyMessage = `Jules API check failed: ${errorMessage}`;

        if (errorMessage.includes('401') || errorMessage.includes('403')) {
            friendlyMessage = "Authentication Failed: JULES_API_KEY is invalid, revoked, or lacks permissions.";
        } else if (errorMessage.includes('429')) {
            status = 'DEGRADED';
            friendlyMessage = "Rate Limited: Jules API quota exceeded or rate limit hit.";
        } else if (errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503')) {
            status = 'DEGRADED';
            friendlyMessage = "Upstream Error: Google Jules API is experiencing internal issues.";
        }

        return {
            status,
            message: friendlyMessage,
            latencyMs: latency,
            meta: {
                rawError: errorMessage
            }
        };
    }
}