
import { Env } from "../../types";

export interface HealthResult {
    tool: string;
    status: 'healthy' | 'unhealthy';
    message?: string;
}

export const checkHealth = async (env: Env): Promise<HealthResult> => {
    try {
        if (!env.DB) {
            return { tool: 'jules-knowledge', status: 'unhealthy', message: 'DB binding missing' };
        }
        if (!env.JULES_MCP_VECTORIZE) {
            return { tool: 'jules-knowledge', status: 'unhealthy', message: 'JULES_MCP_VECTORIZE binding missing' };
        }
        return { tool: 'jules-knowledge', status: 'healthy' };
    } catch (e) {
        return { tool: 'jules-knowledge', status: 'unhealthy', message: String(e) };
    }
};
