// types.ts

export interface JulesClientOptions {
    apiKey: string;
    baseUrl?: string;
}

export enum SessionState {
    STATE_UNSPECIFIED = 'STATE_UNSPECIFIED',
    QUEUED = 'QUEUED',
    PLANNING = 'PLANNING',
    AWAITING_PLAN_APPROVAL = 'AWAITING_PLAN_APPROVAL',
    AWAITING_USER_FEEDBACK = 'AWAITING_USER_FEEDBACK',
    IN_PROGRESS = 'IN_PROGRESS',
    PAUSED = 'PAUSED',
    FAILED = 'FAILED',
    COMPLETED = 'COMPLETED',
}

export enum AutomationMode {
    AUTOMATION_MODE_UNSPECIFIED = 'AUTOMATION_MODE_UNSPECIFIED',
    AUTO_CREATE_PR = 'AUTO_CREATE_PR',
}

// --- GitHub & Source Context ---

export interface GitHubBranch {
    displayName: string;
}

export interface GitHubRepo {
    owner: string;
    repo: string;
    isPrivate: boolean;
    defaultBranch: GitHubBranch;
    branches: GitHubBranch[];
}

export interface GitHubRepoContext {
    startingBranch: string;
}

export interface SourceContext {
    source: string; // Format: sources/{source}
    githubRepoContext?: GitHubRepoContext;
}

export interface Source {
    name: string; // sources/github-owner-repo
    id: string;   // github-owner-repo
    githubRepo: GitHubRepo;
}

// --- Activities & Artifacts ---

export interface GitPatch {
    baseCommitId: string;
    unidiffPatch: string;
    suggestedCommitMessage: string;
}

export interface ChangeSet {
    source: string;
    gitPatch: GitPatch;
}

export interface BashOutput {
    command: string;
    output: string;
    exitCode: number;
}

export interface Media {
    mimeType: string;
    data: string; // Base64
}

export interface Artifact {
    changeSet?: ChangeSet;
    bashOutput?: BashOutput;
    media?: Media;
}

export interface PlanStep {
    id: string;
    index: number;
    title: string;
    description: string;
}

export interface Plan {
    id: string;
    steps: PlanStep[];
    createTime: string;
}

export interface Activity {
    name: string;
    id: string;
    originator: 'user' | 'agent' | 'system';
    description: string;
    createTime: string;
    artifacts?: Artifact[];
    // Event Types
    planGenerated?: { plan: Plan };
    planApproved?: { planId: string };
    userMessaged?: { userMessage: string };
    agentMessaged?: { agentMessage: string };
    progressUpdated?: { title: string; description: string };
    sessionCompleted?: Record<string, never>;
    sessionFailed?: { reason: string };
}

// --- Sessions ---

export interface PullRequest {
    url: string;
    title: string;
    description: string;
}

export interface SessionOutput {
    pullRequest?: PullRequest;
}

export interface Session {
    name: string; // sessions/{id}
    id: string;
    prompt: string;
    title?: string;
    state: SessionState;
    url?: string;
    sourceContext: SourceContext;
    requirePlanApproval?: boolean;
    automationMode?: AutomationMode;
    outputs?: SessionOutput[];
    createTime: string;
    updateTime: string;
}

// --- Request/Response Interfaces ---

export interface CreateSessionRequest {
    prompt: string;
    sourceContext: SourceContext;
    title?: string;
    requirePlanApproval?: boolean;
    automationMode?: AutomationMode;
}

export interface ListResponse<T> {
    nextPageToken?: string;
}

export interface ListSourcesResponse extends ListResponse<Source> {
    sources: Source[];
}

export interface ListSessionsResponse extends ListResponse<Session> {
    sessions: Session[];
}

export interface ListActivitiesResponse extends ListResponse<Activity> {
    activities: Activity[];
}

export interface SendMessageRequest {
    prompt: string;
}

export interface JulesError {
    error: {
        code: number;
        message: string;
        status: string;
    };
}

export interface HealthResult {
    status: 'OK' | 'FAILURE' | 'DEGRADED';
    message?: string;
    latencyMs?: number;
    meta?: Record<string, any>;
}