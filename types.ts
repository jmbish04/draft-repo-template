// Removed invalid import

export interface Env {
    JULES_API_KEY: string;
    MCP_AUTH_TOKEN: string;
    AUTH_DISABLED: string;
    CLOUDFLARE_ACCOUNT_ID: string;

    // Cloudflare Tokens for MCP Tools
    CF_AIG_TOKEN: string;
    CF_BROWSER_RENDER_TOKEN: string;
    CLOUDFLARE_AI_SEARCH_TOKEN: string;
    CLOUDFLARE_WORKER_ADMIN_TOKEN: string;
    CLOUDFLARE_OBSERVABILITY_TOKEN: string;
    CLOUDFLARE_API_TOKEN: string; // Primary Auth
    CLOUFLARE_R2_TOKEN: string;

    // AI Keys
    GEMINI_API_KEY: string;
    OPENAI_API_KEY: string;
    GITHUB_TOKEN: string;

    // Vars
    GEMINI_MODEL?: string;
    OPENAI_MODEL?: string;
    AI_GATEWAY_NAME?: string;

    // Durable Objects
    EXPERT_AGENT: DurableObjectNamespace;
    BABYSITTER_AGENT: DurableObjectNamespace;
    JUDGE_AGENT: DurableObjectNamespace;
    SANDBOX: DurableObjectNamespace;
    CONTAINER_MANAGER: DurableObjectNamespace;
    VERIFICATION_AGENT: DurableObjectNamespace;
    ARCHITECT_AGENT: DurableObjectNamespace;
    QA_AGENT: DurableObjectNamespace;
    ORCHESTRATOR_AGENT: DurableObjectNamespace;
    DASHBOARD_AGENT: DurableObjectNamespace;
    OVERSEER_AGENT: DurableObjectNamespace;
    SENTINEL_AGENT: DurableObjectNamespace;
    LOAD_BALANCER_STATE: KVNamespace;

    // Databases & Storage
    DB: D1Database;
    KV: KVNamespace;
    CACHE?: KVNamespace;
    BUCKET: R2Bucket;

    // Queues
    QUEUE_INGEST: Queue;
    QUEUE_WEBHOOK: Queue;
    QUEUE_ADVISOR: Queue;

    // Services
    BROWSER: Fetcher;
    AI: Ai;
    ASSETS: Fetcher;
    GITHUB_WORKER: Fetcher; // Internal Webhook Aggregator
    JULES_MCP_VECTORIZE: VectorizeIndex; // Deep Research Knowledge Base
    // VECTOR_INDEX: VectorizeIndex; DELETED
    // VECTOR_REGULATION_INDEX: VectorizeIndex; DELETED

    // R2 Manual Config
    R2_ACCESS_KEY_ID?: string;
    R2_SECRET_ACCESS_KEY?: string;
    R2_ENDPOINT_URL?: string;
    R2_BUCKET_NAME?: string;

    // Workflows
    ADVISOR_WORKFLOW: Workflow;
    INGEST_WORKFLOW: Workflow;

    // Optional / Legacy
    WORKER_URL?: string;
}
