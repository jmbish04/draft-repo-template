import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ZodRawShape } from "../utils/schema";

export type ToolHandler<TParams, TClient> = (
  params: TParams,
  client: TClient
) => Promise<CallToolResult>;

/**
 * Tool definition following
 * Schema is a ZodRawShape (the shape object passed to z.object())
 * which the MCP SDK converts to JSON Schema internally.
 */
export interface ToolDefinition<TParams = any, TClient = any> {
  name: string;
  description: string;
  schema: ZodRawShape;
  handler: ToolHandler<TParams, TClient>;
}
