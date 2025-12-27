
import { Env } from "../types";
import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient } from "@prisma/client";
import { generateEmbedding } from "../ai/providers/worker-ai";

export class KnowledgeBaseService {
    private prisma: PrismaClient;

    constructor(private env: Env) {
        const adapter = new PrismaD1(env.DB);
        this.prisma = new PrismaClient({ adapter });
    }

    /**
     * Adds a pattern to the local memory.
     * STRICTLY enforces D1 creation first, then Vectorize upsert with D1 ID.
     */
    async addKnowledge(content: string, category: string, tags: string[] = []) {
        // 1. Create D1 Record
        const record = await (this.prisma as any).julesKnowledge.create({
            data: {
                content,
                category,
                tags: JSON.stringify(tags)
            }
        });

        // 2. Generate Embedding
        // We use the same model as configured for query defaults
        const embeddings = await generateEmbedding(this.env, content);

        // 3. Upsert to Vectorize using D1 ID
        await this.env.JULES_MCP_VECTORIZE.upsert([{
            id: record.id,
            values: embeddings,
            metadata: {
                category
            }
        }]);

        return record;
    }

    /**
     * Recalls patterns from local memory.
     */
    async recallKnowledge(query: string, category?: string, limit = 5): Promise<string> {
        // 1. Generate Query Embedding
        const embeddings = await generateEmbedding(this.env, query);

        // 2. Query Vectorize
        // Note: Filter structure depends on Vectorize API (metadata-filtering supported in recent versions)
        // For now we'll do basic query. If category supports filtering in future, add it.
        const matches = await this.env.JULES_MCP_VECTORIZE.query(embeddings, {
            topK: limit,
            returnMetadata: true
            // namespace: category ? ... // Vectorize namespaces are strictly separate indexes usually, or metadata filters
        });

        if (!matches.matches || matches.matches.length === 0) {
            return "No relevant local patterns found.";
        }

        const ids = matches.matches.map(m => m.id);

        // 3. Fetch Content from D1
        const records = await (this.prisma as any).julesKnowledge.findMany({
            where: {
                id: { in: ids }
            }
        });

        // 4. Format Output
        if (records.length === 0) return "No relevant local patterns found (DB miss).";

        return records.map((r: any) => `[${r.category}] ${r.content}`).join("\n\n---\n\n");
    }
}
