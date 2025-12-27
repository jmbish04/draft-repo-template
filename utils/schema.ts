/**
 * -----------------------------------------------------------------------------
 * FILE: schema.ts
 * MODULE: Utils
 * -----------------------------------------------------------------------------
 * DESCRIPTION:
 * Single Source of Truth for Zod + OpenAPI + AI SDK.
 * * CRITICAL:
 * This file explicitly re-exports the `z` instance from `@hono/zod-openapi`.
 * This instance has been extended with the `.openapi()` method.
 * We DO NOT export `* from "zod"` to prevent accidental usage of the 
 * un-extended or version-mismatched Zod library.
 * -----------------------------------------------------------------------------
 */

import { z as zHono, OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { zodToJsonSchema } from "zod-to-json-schema";
import { jsonSchema } from "ai";

// 1. Export the ONE TRUE ZOD instance (Hono-enhanced)
export const z = zHono;
// Re-export specific types if needed, but DO NOT export * from "zod"
export type { ZodRawShape, ZodType, ZodSchema } from "zod";
export type Infer<T extends { _output: any }> = T["_output"];

// 2. Export Hono/OpenAPI helpers so consumers don't need direct @hono imports
//    This keeps all schema/routing logic bound to the same library version.
export { OpenAPIHono, createRoute };

// 3. Bridge Function: Converts Zod schemas to AI SDK compatible JSON schemas
export function toAiSchema<T>(zodSchema: zHono.ZodType<T>): any {
    // We cast to 'any' at the end to prevent deep type instantiation errors 
    // between Vercel AI SDK types and Zod types during compilation.
    return jsonSchema(zodToJsonSchema(zodSchema as unknown as any) as any);
}
