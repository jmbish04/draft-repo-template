export * from './types';
export * from './client';
export * from './smart-poller';
export * from './activity-service';
export * from './context-helper';
export * from './health';

import { Env } from "../../types";
import { JulesActivityService } from "./activity-service";
import { z } from "../../utils/schema";

export const getJulesTools = (env: Env) => {
    return [
        {
            name: "jules_activity",
            description: "Log an activity or status update to the centralized Jules dashboard.",
            parameters: z.object({
                type: z.enum(["TASK_START", "TASK_COMPLETE", "ERROR", "LIFECYCLE", "TOOL_USE"]),
                message: z.string(),
                meta: z.record(z.string(), z.any()).optional()
            }),
            execute: async (args: { type: string, message: string, meta?: any }) => {
                const apiKey = env.JULES_API_KEY;
                if (!apiKey) throw new Error("JULES_API_KEY is missing");

                const { JulesClient } = await import("./client");
                const client = new JulesClient({ apiKey });
                // @ts-ignore
                const service = new JulesActivityService(client, env.DB);
                await service.logCheckIn(args.type as any, args.message, args.meta);
                return "Activity logged successfully.";
            }
        },
        {
            name: "jules_list_sessions",
            description: "List recent Jules coding sessions from the remote platform.",
            parameters: z.object({
                pageSize: z.number().optional().default(10)
            }),
            execute: async (args: { pageSize?: number }) => {
                const { JulesClient } = await import("./client");
                const client = new JulesClient({ apiKey: env.JULES_API_KEY! });
                return await client.listSessions(args);
            }
        },
        {
            name: "jules_create_session",
            description: "Start a new Jules coding session.",
            parameters: z.object({
                prompt: z.string(),
                source: z.string(),
                title: z.string().optional()
            }),
            execute: async (args: { prompt: string, source: string, title?: string }) => {
                const { JulesClient } = await import("./client");
                const client = new JulesClient({ apiKey: env.JULES_API_KEY! });
                return await client.createSession({
                    prompt: args.prompt,
                    sourceContext: { source: args.source },
                    title: args.title
                });
            }
        },
        {
            name: "jules_get_activity",
            description: "Get detailed activity logs for a specific Jules session.",
            parameters: z.object({
                sessionId: z.string()
            }),
            execute: async (args: { sessionId: string }) => {
                const { JulesClient } = await import("./client");
                const client = new JulesClient({ apiKey: env.JULES_API_KEY! });
                return await client.listActivities(args.sessionId);
            }
        },
        {
            name: "jules_send_message",
            description: "Send a message/reply to an active Jules session.",
            parameters: z.object({
                sessionId: z.string(),
                prompt: z.string()
            }),
            execute: async (args: { sessionId: string, prompt: string }) => {
                const { JulesClient } = await import("./client");
                const client = new JulesClient({ apiKey: env.JULES_API_KEY! });
                return await client.sendMessage(args.sessionId, args.prompt);
            }
        },
        {
            name: "jules_get_unified_activity",
            description: "Get recent activity from both Jules API and local system logs.",
            parameters: z.object({
                limit: z.number().optional().default(10)
            }),
            execute: async (args: { limit?: number }) => {
                const { JulesClient } = await import("./client");
                const client = new JulesClient({ apiKey: env.JULES_API_KEY! });
                const service = new JulesActivityService(client, env.DB as any);
                return await service.getUnifiedRecentActivity(args.limit);
            }
        },
        {
            name: "jules_enrich_context",
            description: "Gather rich context (bindings, docs) to improve prompt quality.",
            parameters: z.object({
                prompt: z.string(),
                includeBindings: z.boolean().optional(),
                includeDocs: z.array(z.string()).optional()
            }),
            execute: async (args: { prompt: string, includeBindings?: boolean, includeDocs?: string[] }) => {
                const { JulesClient } = await import("./client");
                const { JulesContextHelper } = await import("./context-helper");
                const client = new JulesClient({ apiKey: env.JULES_API_KEY! });
                const helper = new JulesContextHelper(env, client);
                return await helper.enrichContext(args.prompt, args);
            }
        }
    ];
};
