
/**
 * -----------------------------------------------------------------------------
 * FILE: types.ts
 * MODULE: Workflows
 * -----------------------------------------------------------------------------
 * DESCRIPTION:
 * Type definitions for Cloudflare Workflows used in the Total Orchestration system.
 * -----------------------------------------------------------------------------
 */

export interface IngestPayload {
    origin: "CHAT" | "GITHUB_RPC" | "POLLER_DISCOVERY";
    rawPrompt: string;
    sourceContext?: { repo?: string; pr?: number; sessionId?: string };
    userId?: string;
    autoApprove?: boolean;
}

export interface AdvisorPayload {
    prompt: string;
    intent: "NEW_PROJECT" | "BUG_FIX" | "REFACTOR" | "UNKNOWN";
    projectContext?: any;
}

export interface AdvisorResult {
    enhancedPrompt: string; // The "Super Prompt" for Jules
    technicalContext: {
        bindings: string[];
        docs: string[];
        architecture: string;
    };
    qualityScore: number; // From Judge
}
