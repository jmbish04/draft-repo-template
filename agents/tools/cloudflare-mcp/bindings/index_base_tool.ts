import { BaseTool, z } from "../../../tools/base";
import { cfFetch } from "../../cloudflare-utils";
import type { Env } from "../../../../types";

// --- ACCOUNT ---

export class CfAccountListTool extends BaseTool<{}, any> {
  name = "cf_account_list";
  description = "List all accounts the API token has access to.";
  schema = z.object({});

  constructor(private env: Env) {
    super();
  }

  public async execute(args: {}) {
    return cfFetch(this.env, "/accounts");
  }
}

// --- WORKERS ---

export class CfWorkerListTool extends BaseTool<{}, any> {
  name = "cf_worker_list";
  description = "List all Workers/Scripts in the account.";
  schema = z.object({});

  constructor(private env: Env) {
    super();
  }

  public async execute(args: {}) {
    return cfFetch(this.env, `/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts`);
  }
}

export class CfWorkerGetTool extends BaseTool<{ scriptName: string }, any> {
  name = "cf_worker_get";
  description = "Get details of a specific Cloudflare Worker.";
  schema = z.object({
    scriptName: z.string().describe("The name of the worker script"),
  });

  constructor(private env: Env) {
    super();
  }

  public async execute(args: { scriptName: string }) {
    return cfFetch(this.env, `/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${args.scriptName}`);
  }
}

// --- KV NAMESPACES ---

export class CfKvListTool extends BaseTool<{}, any> {
  name = "cf_kv_list";
  description = "List all KV namespaces.";
  schema = z.object({});

  constructor(private env: Env) {
    super();
  }

  public async execute(args: {}) {
    return cfFetch(this.env, `/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces`);
  }
}

export class CfKvCreateTool extends BaseTool<{ title: string }, any> {
  name = "cf_kv_create";
  description = "Create a new KV namespace.";
  schema = z.object({
    title: z.string().describe("A human-readable name for the namespace"),
  });

  constructor(private env: Env) {
    super();
  }

  public async execute(args: { title: string }) {
    return cfFetch(this.env, `/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces`, {
      method: "POST",
      body: JSON.stringify({ title: args.title }),
    });
  }
}

// --- D1 DATABASES ---

export class CfD1ListTool extends BaseTool<{}, any> {
  name = "cf_d1_list";
  description = "List all D1 databases.";
  schema = z.object({});

  constructor(private env: Env) {
    super();
  }

  public async execute(args: {}) {
    return cfFetch(this.env, `/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/d1/database`);
  }
}

export class CfD1CreateTool extends BaseTool<{ name: string }, any> {
  name = "cf_d1_create";
  description = "Create a new D1 database.";
  schema = z.object({
    name: z.string().describe("The name of the database"),
  });

  constructor(private env: Env) {
    super();
  }

  public async execute(args: { name: string }) {
    return cfFetch(this.env, `/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/d1/database`, {
      method: "POST",
      body: JSON.stringify({ name: args.name }),
    });
  }
}

export class CfD1QueryTool extends BaseTool<{ databaseId: string; sql: string; params?: string[] }, any> {
  name = "cf_d1_query";
  description = "Execute a SQL query against a D1 database via the API.";
  schema = z.object({
    databaseId: z.string().describe("The UUID of the D1 database"),
    sql: z.string().describe("The SQL query to execute"),
    params: z.array(z.string()).optional().describe("Query parameters"),
  });

  constructor(private env: Env) {
    super();
  }

  public async execute(args: { databaseId: string; sql: string; params?: string[] }) {
    return cfFetch(this.env, `/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${args.databaseId}/query`, {
      method: "POST",
      body: JSON.stringify({ sql: args.sql, params: args.params || [] }),
    });
  }
}

// --- R2 BUCKETS ---

export class CfR2ListTool extends BaseTool<{}, any> {
  name = "cf_r2_list";
  description = "List R2 buckets.";
  schema = z.object({});

  constructor(private env: Env) {
    super();
  }

  public async execute(args: {}) {
    return cfFetch(this.env, `/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/r2/buckets`);
  }
}

export class CfR2CreateTool extends BaseTool<{ name: string }, any> {
  name = "cf_r2_create";
  description = "Create a new R2 bucket.";
  schema = z.object({
    name: z.string().describe("Name of the bucket"),
  });

  constructor(private env: Env) {
    super();
  }

  public async execute(args: { name: string }) {
    return cfFetch(this.env, `/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/r2/buckets`, {
      method: "POST",
      body: JSON.stringify({ name: args.name }),
    });
  }
}

// --- HYPERDRIVE ---

export class CfHyperdriveListTool extends BaseTool<{}, any> {
  name = "cf_hyperdrive_list";
  description = "List Hyperdrive configurations.";
  schema = z.object({});

  constructor(private env: Env) {
    super();
  }

  public async execute(args: {}) {
    return cfFetch(this.env, `/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/hyperdrive/configs`);
  }
}

const hyperdriveOriginSchema = z.object({
  host: z.string(),
  port: z.number(),
  database: z.string(),
  user: z.string(),
  password: z.string(),
  scheme: z.enum(["postgres", "postgresql", "mysql"]),
});

export class CfHyperdriveCreateTool extends BaseTool<{ name: string; origin: z.infer<typeof hyperdriveOriginSchema> }, any> {
  name = "cf_hyperdrive_create";
  description = "Create a Hyperdrive configuration.";
  schema = z.object({
    name: z.string(),
    origin: hyperdriveOriginSchema,
  });

  constructor(private env: Env) {
    super();
  }

  public async execute(args: { name: string; origin: z.infer<typeof hyperdriveOriginSchema> }) {
    return cfFetch(this.env, `/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/hyperdrive/configs`, {
      method: "POST",
      body: JSON.stringify(args),
    });
  }
}