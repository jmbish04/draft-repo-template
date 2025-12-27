/**
 * -----------------------------------------------------------------------------
 * FILE: jules-monitor.ts
 * MODULE: Services
 * -----------------------------------------------------------------------------
 * DESCRIPTION:
 * Persistent Jules Monitoring Service - Upgrades from ephemeral polling to
 * database-backed session lifecycle management with automatic interventions.
 * 
 * KEY FEATURES:
 * - Discover and adopt external Jules sessions
 * - Track session lifecycle in D1
 * - Auto-approve plans when configured
 * - Dispatch agent interventions for stuck sessions
 * - Prevent duplicate replies via interaction logging
 * -----------------------------------------------------------------------------
 */

import { PrismaClient, JulesSession, JulesInteraction } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";
import { JulesClient } from "../tools/jules/client";
import { Session, SessionState } from "../tools/jules/types";
import { Env } from "../types";

// Enhanced context structure for agent interventions
interface EnhancedContext {
    bindings: string[];
    techStack: string[];
    constraints: string[];
    documentation: string[];
}

// Session origin types
const ORIGIN = {
    INTERNAL: "INTERNAL",
    EXTERNAL: "EXTERNAL"
} as const;

// Interaction types for logging
const INTERACTION_TYPE = {
    STATUS_CHECK: "STATUS_CHECK",
    AUTO_APPROVAL: "AUTO_APPROVAL",
    INTERVENTION_NEEDED: "INTERVENTION_NEEDED",
    AGENT_REPLY: "AGENT_REPLY",
    RETROFIT: "RETROFIT",
    ERROR: "ERROR"
} as const;

export class JulesMonitorService {
    private prisma: PrismaClient;
    private julesClient: JulesClient;
    private env: Env;

    constructor(env: Env) {
        this.env = env;

        // Initialize Prisma with D1 adapter
        const adapter = new PrismaD1(env.DB);
        this.prisma = new PrismaClient({ adapter });

        // Initialize Jules client
        if (!env.JULES_API_KEY) {
            throw new Error("JULES_API_KEY is required for JulesMonitorService");
        }
        this.julesClient = new JulesClient({ apiKey: env.JULES_API_KEY });
    }

    /**
     * Main entry point for cron job - orchestrates sync and health checks
     */
    async run(): Promise<{ synced: number; checked: number; interventions: number }> {
        console.log("🕒 JulesMonitor: Starting sync...");

        // 1. Discover new sessions (Discovery Phase)
        const synced = await this.syncExternalSessions();

        // 2. Sync Active Sessions (Status & Activity Phase)
        // This replaces the old 'runHealthChecks' with the optimized logic
        await this.runActiveSessionSync();

        console.log(`🕒 JulesMonitor: Complete. External Synced: ${synced}`);

        // Return simpler stats since 'checked/interventions' isn't explicitly returned by runActiveSessionSync
        return { synced, checked: 0, interventions: 0 };
    }

    /**
     * Poll external sessions and adopt them if not already tracked
     */
    async syncExternalSessions(): Promise<number> {
        let syncedCount = 0;
        try {
            // Get recent sessions from Jules
            const response = await this.julesClient.listSessions({ pageSize: 20 });
            const externalSessions = response.sessions || [];

            for (const extSession of externalSessions) {
                // Check if we already track this session
                const existing = await this.prisma.julesSession.findUnique({
                    where: { id: extSession.id }
                });

                if (!existing) {
                    console.log(`✨ Discovered new external session: ${extSession.id}`);

                    // Create local record
                    await this.prisma.julesSession.create({
                        data: {
                            id: extSession.id,
                            title: extSession.title,
                            status: extSession.state,
                            origin: ORIGIN.EXTERNAL,
                            originalPrompt: "External Session",
                            updatedAt: new Date(extSession.updateTime)
                        }
                    });
                    syncedCount++;
                }
            }
        } catch (e) {
            console.error("Failed to sync external sessions", e);
        }
        return syncedCount;
    }

    /**
     * Optimized Sync: Iterates ONLY active sessions from D1 to save API quota.
     * Checks status directly by ID and syncs activities.
     */
    async runActiveSessionSync() {
        console.log("🔄 Starting Active Session Sync...");

        // 1. Fetch only ACTIVE sessions from DB (Ignore COMPLETED/FAILED)
        const activeSessions = await this.prisma.julesSession.findMany({
            where: {
                status: {
                    notIn: ['COMPLETED', 'FAILED']
                }
            }
        });

        if (activeSessions.length === 0) {
            console.log("No active sessions to sync.");
            return;
        }

        console.log(`Polling ${activeSessions.length} active sessions...`);

        for (const dbSession of activeSessions) {
            try {
                // 2. Direct Status Check (GET /sessions/{id})
                // Much lighter than listing all sessions
                const remoteSession = await this.julesClient.getSession(dbSession.id);

                // 3. Status Update Logic
                if (remoteSession.state !== dbSession.status) {
                    console.log(`📝 Status Change [${dbSession.id}]: ${dbSession.status} -> ${remoteSession.state}`);
                    await this.prisma.julesSession.update({
                        where: { id: dbSession.id },
                        data: {
                            status: remoteSession.state,
                            // If closed now, set completedAt
                            completedAt: (remoteSession.state === 'COMPLETED' || remoteSession.state === 'FAILED')
                                ? new Date()
                                : null
                        }
                    });
                }

                // 4. Activity Sync (Only for this specific session)
                await this.syncActivitiesForSession(dbSession.id);

            } catch (e) {
                console.error(`Failed to sync session ${dbSession.id}`, e);
            }
        }

        // 5. Update Cache Timestamp for UI
        if (this.env.KV) {
            await this.env.KV.put("DASHBOARD_LAST_SYNC", new Date().toISOString());
        }
    }

    /**
     * Fetch and persist activities for a single session
     */
    private async syncActivitiesForSession(sessionId: string) {
        try {
            const response = await this.julesClient.listActivities(sessionId, { pageSize: 10 });
            const activities = response.activities || [];

            for (const act of activities) {
                // Idempotency check using remote_id in metadata
                const remoteId = act.name.split('/').pop(); // Extract activity ID from resource name

                // Check uniqueness in ActivityLog
                // We use metadata string contains for now or exact match if structured
                // Assuming we store it in metadata JSON
                const exists = await this.prisma.activityLog.findFirst({
                    where: {
                        sessionId: sessionId,
                        metadata: { contains: remoteId }
                    }
                });

                if (!exists) {
                    await this.prisma.activityLog.create({
                        data: {
                            sessionId: sessionId, // CRITICAL: Link to session
                            agent: 'Jules',
                            action: 'REMOTE_UPDATE',
                            result: act.description,
                            success: true,
                            timestamp: new Date(act.createTime),
                            metadata: JSON.stringify({
                                remote_id: remoteId,
                                full_resource: act.name,
                                type: 'JULES_SYNC',
                                original_act: act
                            })
                        }
                    });
                }
            }
        } catch (e) {
            console.warn(`Activity sync failed for ${sessionId}`, e);
        }
    }

    /**
     * Auto-approve pending plans
     */
    private async handlePlanApproval(dbSession: JulesSession, liveSession: Session): Promise<void> {
        console.log(`✅ Auto-approving plan for session ${dbSession.id}`);

        try {
            await this.julesClient.approvePlan(dbSession.id);

            await this.logInteraction(dbSession.id, {
                type: INTERACTION_TYPE.AUTO_APPROVAL,
                agentResponse: "Plan automatically approved by JulesMonitorService",
                isSuccess: true
            });
        } catch (error) {
            console.error(`Error approving plan:`, error);

            await this.logInteraction(dbSession.id, {
                type: INTERACTION_TYPE.ERROR,
                errorMessage: `Plan approval failed: ${String(error)}`,
                isSuccess: false
            });
        }
    }

    /**
     * Handle sessions waiting for user feedback
     * Includes loop prevention to avoid duplicate replies
     */
    private async handleUserFeedback(dbSession: JulesSession, liveSession: Session): Promise<boolean> {
        // Get the last message from Jules (what they're asking)
        const activities = await this.julesClient.listActivities(dbSession.id, { pageSize: 5 });
        const lastAgentMessage = activities.activities?.find(a => a.agentMessaged);

        if (!lastAgentMessage?.agentMessaged?.agentMessage) {
            return false; // No question to answer
        }

        const julesQuestion = lastAgentMessage.agentMessaged.agentMessage;

        // LOOP PREVENTION: Check if we already replied to this exact question
        const existingReply = await this.prisma.julesInteraction.findFirst({
            where: {
                sessionId: dbSession.id,
                type: INTERACTION_TYPE.AGENT_REPLY,
                julesMessage: julesQuestion
            },
            orderBy: { timestamp: 'desc' }
        });

        if (existingReply) {
            console.log(`⚠️ Already replied to this question for session ${dbSession.id}, skipping...`);
            return false;
        }

        // Generate response using Overseer
        console.log(`🤖 Generating intervention for session ${dbSession.id}...`);

        const context: EnhancedContext = dbSession.enhancedContext
            ? JSON.parse(dbSession.enhancedContext)
            : { bindings: [], techStack: [], constraints: [], documentation: [] };

        const agentResponse = await this.generateIntervention(julesQuestion, context);

        // Send the response to Jules
        try {
            await this.julesClient.sendMessage(dbSession.id, agentResponse);

            await this.logInteraction(dbSession.id, {
                type: INTERACTION_TYPE.AGENT_REPLY,
                julesMessage: julesQuestion,
                agentResponse,
                isSuccess: true
            });

            console.log(`✅ Intervention sent for session ${dbSession.id}`);
            return true;

        } catch (error) {
            console.error(`Error sending intervention:`, error);

            await this.logInteraction(dbSession.id, {
                type: INTERACTION_TYPE.ERROR,
                julesMessage: julesQuestion,
                errorMessage: `Failed to send intervention: ${String(error)}`,
                isSuccess: false
            });

            return false;
        }
    }

    /**
     * Generate an intervention response using Overseer agent
     */
    private async generateIntervention(question: string, context: EnhancedContext): Promise<string> {
        // Try to use Overseer agent
        const doNamespace = this.env.OVERSEER_AGENT;

        if (doNamespace) {
            try {
                const id = doNamespace.idFromName("default");
                const stub = doNamespace.get(id);

                const response = await stub.fetch(new Request("http://internal/task", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        type: "INTERVENTION",
                        payload: { question, context }
                    })
                }));

                if (response.ok) {
                    const result = await response.json() as any;
                    return result.result || result.response || "I'll help with that.";
                }
            } catch (e) {
                console.warn("Overseer unavailable, using fallback response:", e);
            }
        }

        // Fallback: Search cloudflare-docs and provide basic guidance
        return this.generateFallbackResponse(question, context);
    }

    /**
     * Fallback response generation when Overseer is unavailable
     */
    private generateFallbackResponse(question: string, context: EnhancedContext): string {
        const lines: string[] = [];

        lines.push("Based on your question, here's what I recommend:");
        lines.push("");

        if (context.bindings.length > 0) {
            lines.push(`Note: This project uses: ${context.bindings.join(", ")}`);
        }

        // Check for common question patterns
        if (question.toLowerCase().includes("error") || question.toLowerCase().includes("failed")) {
            lines.push("1. Check the error message for specific details");
            lines.push("2. Verify all required environment variables are set");
            lines.push("3. Ensure wrangler.toml has correct bindings configured");
        } else if (question.toLowerCase().includes("how") || question.toLowerCase().includes("should")) {
            lines.push("Please proceed with your best judgment based on the requirements.");
            lines.push("I trust your implementation approach.");
        } else {
            lines.push("Please continue with your current approach.");
        }

        return lines.join("\n");
    }

    /**
     * Helper: Log an interaction to the database
     */
    private async logInteraction(sessionId: string, data: {
        type: string;
        julesMessage?: string;
        agentResponse?: string;
        isSuccess: boolean;
        errorMessage?: string;
    }): Promise<void> {
        await this.prisma.julesInteraction.create({
            data: {
                sessionId,
                type: data.type,
                julesMessage: data.julesMessage,
                agentResponse: data.agentResponse,
                isSuccess: data.isSuccess,
                errorMessage: data.errorMessage
            }
        });
    }

    /**
     * Create a new internal session (tracked from creation)
     */
    async createTrackedSession(params: {
        prompt: string;
        title?: string;
        sourceName?: string;
        enhancedContext?: EnhancedContext;
    }): Promise<Session> {
        // Create session in Jules
        const session = await this.julesClient.createSession({
            prompt: params.prompt,
            title: params.title,
            sourceContext: { source: params.sourceName || "sources/default" }
        });

        // Track in our database
        await this.prisma.julesSession.create({
            data: {
                id: session.id,
                title: session.title || params.title,
                originalPrompt: params.prompt,
                status: session.state,
                origin: ORIGIN.INTERNAL,
                sourceName: params.sourceName,
                enhancedContext: params.enhancedContext ? JSON.stringify(params.enhancedContext) : null
            }
        });

        console.log(`📝 Created tracked session: ${session.id}`);

        return session;
    }

    /**
     * Get session with all interactions
     */
    async getSessionWithHistory(sessionId: string): Promise<JulesSession & { interactions: JulesInteraction[] } | null> {
        return await this.prisma.julesSession.findUnique({
            where: { id: sessionId },
            include: { interactions: { orderBy: { timestamp: 'desc' } } }
        });
    }

    /**
     * Get all sessions with optional status filter
     */
    async getSessions(filter?: { status?: string; origin?: string }): Promise<JulesSession[]> {
        return await this.prisma.julesSession.findMany({
            where: filter,
            orderBy: { updatedAt: 'desc' }
        });
    }
}
