import { JulesClient } from "./client";
import { Env } from "../../types";
import { SearchService } from "../../ai/utils/search";
// Note: We avoid importing massive SDKs here to keep the helper lightweight. 
// It relies on the environment bindings.

export interface ContextOptions {
    includeBindings?: boolean;
    includeDocs?: string[]; // Queries to run against docs
    includeRepoInfo?: boolean;
}

export class JulesContextHelper {
    constructor(private env: Env, private client: JulesClient) { }

    /**
     * Gathers rich context to help start a session with the correct bindings and knowledge.
     */
    async enrichContext(userPrompt: string, options: ContextOptions = {}) {
        const contextParts: string[] = [];

        // 1. Bindings Context
        if (options.includeBindings) {
            const bindings = this.listBindings();
            contextParts.push(`\n## Available Cloudflare Bindings\n${bindings}`);
        }

        // 2. Documentation Context
        if (options.includeDocs && options.includeDocs.length > 0) {
            const searchService = new SearchService(this.env);
            const docsContext: string[] = [];

            for (const query of options.includeDocs) {
                try {
                    const results = await searchService.search(query, 3);
                    const snippets = results.map(r => `- ${r.content.substring(0, 200)}...`).join('\n');
                    docsContext.push(`### Query: "${query}"\n${snippets}`);
                } catch (e) {
                    console.warn(`Failed to search docs for "${query}"`, e);
                }
            }
            if (docsContext.length > 0) {
                contextParts.push(`\n## Relevant Documentation\n${docsContext.join('\n')}`);
            }
        }

        // 3. GitHub/Repo Context (Placeholder for now, assumes user handles repo creation)
        // If we had a GitHub Service instance passed in, we could list available repos here.

        return {
            originalPrompt: userPrompt,
            enrichedPrompt: `${userPrompt}\n\n${contextParts.join('\n')}`,
            systemInfo: {
                bindings: this.listBindings(true)
            }
        };
    }

    private listBindings(asArray = false): string | string[] {
        // We inspect the Env object keys to guess bindings
        // This is a heuristic since Env is just an object at runtime in Worker
        const keys = Object.keys(this.env);
        const interesting = keys.filter(k =>
            !k.startsWith('CF_') && !k.startsWith('npm_') && k === k.toUpperCase()
        );

        if (asArray) return interesting;
        return interesting.join(', ');
    }
}
