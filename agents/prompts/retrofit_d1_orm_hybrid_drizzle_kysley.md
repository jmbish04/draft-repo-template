You are an expert Cloudflare Workers + TypeScript developer tasked with refactoring
an existing Worker project that currently uses raw D1 queries (env.DB.prepare, etc.)
into a robust, type-safe hybrid ORM architecture combining Drizzle ORM and Kysely.

### 🎯 Goal
Adopt Drizzle for schema definition, type inference, and migrations;
use Kysely for advanced/dynamic query composition; preserve all functional behavior.

---

## 🧩 Retrofit Plan

1. **Analyze Current State**
   - Parse the current codebase to identify:
     - All calls to `env.DB.prepare`, `.bind()`, `.all()`, `.run()`, `.get()`
     - Inline SQL statements and their table/column references
   - Generate a quick inventory of tables, columns, and relationships inferred
     from those SQL statements.

2. **Create Schema Layer (Drizzle)**
   - Create `src/db/schema.ts` defining each table with Drizzle’s D1 adapter:
     ```ts
     import { sqliteTable, integer, text, primaryKey } from 'drizzle-orm/sqlite-core';

     export const users = sqliteTable('users', {
       id: integer('id').primaryKey({ autoIncrement: true }),
       name: text('name').notNull(),
       email: text('email').notNull().unique(),
     });
     ```
   - Export inferred TypeScript types via Drizzle’s `InferModel<>`.

3. **Setup Migration System**
   - Add `drizzle.config.ts` and `migrations/` folder.
   - Configure `drizzle-kit` for D1:
     ```ts
     import type { Config } from 'drizzle-kit';
     export default {
       schema: './src/db/schema.ts',
       out: './migrations',
       driver: 'd1',
     } satisfies Config;
     ```
   - Generate initial migration:
     `npx drizzle-kit generate`
   - Include command in package.json scripts:
     `"migrate": "wrangler d1 migrations apply <DB_NAME>"`

4. **Initialize ORM Clients**
   - Create `src/db/client.ts`:
     ```ts
     import { drizzle } from 'drizzle-orm/d1';
     import { Kysely, D1Dialect } from 'kysely-d1';
     import * as schema from './schema';

     export const initDb = (env: Env) => ({
       drizzle: drizzle(env.DB, { schema }),
       kysely: new Kysely<typeof schema>({
         dialect: new D1Dialect({ database: env.DB }),
       }),
     });
     ```
   - Use this in your Worker’s fetch handler or Durable Object context.

5. **Refactor Queries**
   - Replace simple CRUD with Drizzle equivalents:
     ```ts
     await db.drizzle.insert(schema.users).values({ name, email }).run();
     const allUsers = await db.drizzle.select().from(schema.users).all();
     ```
   - Replace dynamic filtering, joins, and reporting logic with Kysely:
     ```ts
     const { kysely } = db;
     const results = await kysely.selectFrom('users')
       .selectAll()
       .where('email', 'like', `%${search}%`)
       .limit(50)
       .execute();
     ```
   - Preserve original routes, response structures, and business logic.

6. **Type Inference Unification**
   - Export Drizzle’s inferred types into a shared `Database` interface for Kysely:
     ```ts
     import * as schema from './schema';
     export type Database = {
       users: typeof schema.users.$inferSelect;
       // ... add each table
     };
     ```
     Update Kysely instantiation to use `<Database>` generic.

7. **Testing & Validation**
   - Run migrations locally with `wrangler d1 execute`.
   - Verify identical API outputs pre- and post-refactor.
   - Lint and format code; remove direct SQL references.

8. **Final Cleanup**
   - Delete legacy raw SQL utilities.
   - Document ORM usage in `README.md` with examples for both Drizzle and Kysely.
   - Ensure type safety passes (`tsc --noEmit` clean).

---

### ✅ Deliverables
- `src/db/schema.ts`
- `src/db/client.ts`
- `drizzle.config.ts`
- `migrations/` with initial SQL
- Fully refactored Worker code using Drizzle for structure + Kysely for dynamic queries
- CI/CD step running drizzle-kit + wrangler migrations

---

### 💡 Additional Constraints
- The final implementation must be fully compatible with Cloudflare Workers runtime (no Node-only imports).
- Use ESM syntax.
- Avoid heavy dependencies or ORM decorators.
- Respect D1 transaction and query-size limitations.

Output the complete refactored directory tree with example code
for each new file and diff-style changes for modified ones.
