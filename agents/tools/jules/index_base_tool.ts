import { BaseTool, z } from "../base"; // Adjust import path to your BaseTool
import { Env } from "../../types";
import { JulesClient } from "./client";
import { JulesActivityService } from "./activity-service";
import { JulesContextHelper } from "./context-helper";

// Helper to get client
const getClient = (env: Env) => {
    if (!env.JULES_API_KEY) throw new Error("JULES_API_KEY is missing");
    return new JulesClient({ apiKey: env.JULES_API_KEY });
};

export class JulesActivityTool extends BaseTool {
    name = "jules_activity";
    description = "Log an activity or status update to the centralized Jules dashboard.";
    schema = z.object({
        type: z.enum(["TASK_START", "TASK_COMPLETE", "ERROR", "LIFECYCLE", "TOOL_USE"]),
        message: z.string(),
        meta: z.record(z.string(), z.any()).optional()
    });

    constructor(private env: Env) { super(); }

    async execute(args: { type: string, message: string, meta?: any }) {
        const client = getClient(this.env);
        // @ts-ignore - assuming DB binding exists on env
        const service = new JulesActivityService(client, this.env.DB);
        await service.logCheckIn(args.type as any, args.message, args.meta);
        return "Activity logged successfully.";
    }
}

export class JulesListSessionsTool extends BaseTool {
    name = "jules_list_sessions";
    description = "List recent Jules coding sessions from the remote platform.";
    schema = z.object({
        pageSize: z.number().optional().default(10)
    });

    constructor(private env: Env) { super(); }

    async execute(args: { pageSize?: number }) {
        const client = getClient(this.env);
        return await client.listSessions(args);
    }
}

export class JulesCreateSessionTool extends BaseTool {
    name = "jules_create_session";
    description = "Start a new Jules coding session.";
    schema = z.object({
        prompt: z.string(),
        source: z.string(),
        title: z.string().optional()
    });

    constructor(private env: Env) { super(); }

    async execute(args: { prompt: string, source: string, title?: string }) {
        const client = getClient(this.env);
        return await client.createSession({
            prompt: args.prompt,
            sourceContext: { source: args.source },
            title: args.title
        });
    }
}

export class JulesGetActivityTool extends BaseTool {
    name = "jules_get_activity";
    description = "Get detailed activity logs for a specific Jules session.";
    schema = z.object({
        sessionId: z.string()
    });

    constructor(private env: Env) { super(); }

    async execute(args: { sessionId: string }) {
        const client = getClient(this.env);
        return await client.listActivities(args.sessionId);
    }
}

export class JulesSendMessageTool extends BaseTool {
    name = "jules_send_message";
    description = "Send a message/reply to an active Jules session.";
    schema = z.object({
        sessionId: z.string(),
        prompt: z.string()
    });

    constructor(private env: Env) { super(); }

    async execute(args: { sessionId: string, prompt: string }) {
        const client = getClient(this.env);
        return await client.sendMessage(args.sessionId, args.prompt);
    }
}

export class JulesGetUnifiedActivityTool extends BaseTool {
    name = "jules_get_unified_activity";
    description = "Get recent activity from both Jules API and local system logs.";
    schema = z.object({
        limit: z.number().optional().default(10)
    });

    constructor(private env: Env) { super(); }

    async execute(args: { limit?: number }) {
        const client = getClient(this.env);
        // @ts-ignore
        const service = new JulesActivityService(client, this.env.DB);
        return await service.getUnifiedRecentActivity(args.limit);
    }
}

export class JulesEnrichContextTool extends BaseTool {
    name = "jules_enrich_context";
    description = "Gather rich context (bindings, docs) to improve prompt quality.";
    schema = z.object({
        prompt: z.string(),
        includeBindings: z.boolean().optional(),
        includeDocs: z.array(z.string()).optional()
    });

    constructor(private env: Env) { super(); }

    async execute(args: { prompt: string, includeBindings?: boolean, includeDocs?: string[] }) {
        const client = getClient(this.env);
        const helper = new JulesContextHelper(this.env, client);
        return await helper.enrichContext(args.prompt, args);
    }
}

export const getJulesTools = (env: Env) => [
    new JulesActivityTool(env),
    new JulesListSessionsTool(env),
    new JulesCreateSessionTool(env),
    new JulesGetActivityTool(env),
    new JulesSendMessageTool(env),
    new JulesGetUnifiedActivityTool(env),
    new JulesEnrichContextTool(env)
];