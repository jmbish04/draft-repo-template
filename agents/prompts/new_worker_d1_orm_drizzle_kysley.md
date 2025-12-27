

🧭 PROMPT.md — ORM Architecture & Development Policy

# 🧭 ORM ARCHITECTURE & DEVELOPMENT POLICY

## Core Directive
All data-access and schema management for this Worker MUST follow the **Drizzle + Kysely hybrid standard**.

This hybrid ensures:
- ✅ Type-safe, migration-backed schema control (Drizzle)
- ✅ Dynamic, composable, SQL-grade query flexibility (Kysely)
- ✅ Native compatibility with Cloudflare D1 bindings and edge runtime
- ✅ Zero Node dependencies and minimal runtime overhead

---

## Implementation Rules

### 1. Schema & Migrations — Drizzle
- Define all tables using `drizzle-orm/sqlite-core` in `src/db/schema.ts`.
- Use `drizzle-kit` for schema introspection and migration generation.
- Schema types exported from Drizzle are the **single source of truth** for Kysely.
- Example:
  ```ts
  import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

  export const users = sqliteTable('users', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    email: text('email').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp' }),
  });

2. Database Client Layer
    •   Initialize both Drizzle and Kysely clients from the same D1 binding.
    •   Encapsulate in src/db/client.ts:

import { drizzle } from 'drizzle-orm/d1';
import { Kysely, D1Dialect } from 'kysely-d1';
import * as schema from './schema';

export const initDb = (env: Env) => ({
  drizzle: drizzle(env.DB, { schema }),
  kysely: new Kysely<typeof schema>({
    dialect: new D1Dialect({ database: env.DB }),
  }),
});



3. Query Layer
    •   Use Drizzle for simple CRUD and standard workflow logic:

await db.drizzle.insert(schema.users).values({ email }).run();
const users = await db.drizzle.select().from(schema.users).all();


    •   Use Kysely for dynamic filtering, joins, and analytics queries:

const results = await db.kysely
  .selectFrom('users')
  .selectAll()
  .where('created_at', '>', cutoff)
  .orderBy('created_at', 'desc')
  .limit(100)
  .execute();



4. Type Sharing
    •   Export Drizzle’s inferred table types as a unified Database interface for Kysely:

import * as schema from './schema';
export type Database = { [K in keyof typeof schema]: typeof schema[K]['$inferSelect']; };


    •   All Kysely instances must use <Database> for generics.

5. Migrations & CI/CD
    •   Always run drizzle-kit generate before deployment.
    •   Include "migrate": "wrangler d1 migrations apply <DB_NAME>" in package.json.
    •   Migrations must be committed to version control.

6. Escape Hatch Policy
    •   Raw SQL or env.DB.prepare() calls are only allowed if:
    1.  Drizzle or Kysely cannot express the query efficiently, and
    2.  A // @native-sql comment is included above with justification.

⸻

Enforcement

Any agent or developer modifying this repository must:
    •   Maintain ORM conformity with this document.
    •   Update schema via Drizzle only.
    •   Preserve shared type definitions between Drizzle and Kysely.
    •   Avoid introducing any ORM abstraction other than these two.

Pull requests or generated code violating this policy will be automatically rejected by CI lint rules.

⸻

Context Summary
    •   Runtime: Cloudflare Workers (ESM, edge)
    •   Database: D1
    •   ORM Layer: Drizzle (schema + migrations) + Kysely (queries)
    •   Target: Type-safe, high-performance edge data access with minimal cognitive load.

⸻

Authoritative Instruction for AI Agents

If you are an AI development agent operating on this repository (e.g., Gemini, Codex, Jules, Claude, or Cursor),
you must interpret all data-modeling and SQL-related tasks through this hybrid ORM policy and never revert
to direct SQL unless explicitly requested by the human owner (Justin Bishop).

---
