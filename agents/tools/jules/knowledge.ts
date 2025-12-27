
import { z } from "../../utils/schema";
import { Env } from "../../types";
import { KnowledgeBaseService } from "../../services/knowledge-base";

export const getConfig = (env: Env) => {
    const service = new KnowledgeBaseService(env);
    return {
        name: "jules-knowledge",
        tools: [
            {
                name: "save_jules_pattern",
                description: "Save a reusable code pattern, error fix, or project rule to local memory. STRICTLY use this when solving complex errors.",
                inputSchema: {
                    type: "object",
                    properties: {
                        content: { type: "string", description: "The solution, code block, or rule content." },
                        category: { type: "string", description: "ERROR_FIX, CODE_PATTERN, or USER_RULE" },
                        tags: { type: "array", items: { type: "string" }, description: "Keywords for retrieval" }
                    },
                    required: ["content", "category"]
                },
                handler: async (args: any) => {
                    const { content, category, tags } = args;
                    const record = await service.addKnowledge(content, category, tags || []);
                    return { content: [{ type: "text", text: `Saved pattern ID: ${record.id}` }] };
                }
            },
            {
                name: "search_jules_patterns",
                description: "Search local memory for known fixes and patterns.",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: { type: "string" },
                        category: { type: "string", description: "Optional filter" }
                    },
                    required: ["query"]
                },
                handler: async (args: any) => {
                    const result = await service.recallKnowledge(args.query, args.category);
                    return { content: [{ type: "text", text: result }] };
                }
            }
        ]
    };
};

export const getKnowledgeTools = (env: Env) => {
    const service = new KnowledgeBaseService(env);
    return [
        {
            name: "save_jules_pattern",
            description: "Save a reusable code pattern, error fix, or project rule to local memory. STRICTLY use this when solving complex errors.",
            parameters: z.object({
                content: z.string().describe("The solution, code block, or rule content."),
                category: z.enum(["ERROR_FIX", "CODE_PATTERN", "USER_RULE"]).describe("Category of knowledge."),
                tags: z.array(z.string()).optional().describe("Keywords for retrieval")
            }),
            execute: async (args: { content: string, category: "ERROR_FIX" | "CODE_PATTERN" | "USER_RULE", tags?: string[] }) => {
                const record = await service.addKnowledge(args.content, args.category, args.tags || []);
                return { content: `Saved pattern ID: ${record.id}` };
            }
        },
        {
            name: "search_jules_patterns",
            description: "Search local memory for known fixes and patterns.",
            parameters: z.object({
                query: z.string(),
                category: z.string().optional().describe("Optional filter")
            }),
            execute: async (args: { query: string, category?: string }) => {
                const result = await service.recallKnowledge(args.query, args.category);
                return result;
            }
        }
    ];
};
