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
import {
  JulesListSessionsTool,
  JulesGetActivityTool,
  JulesSendMessageTool,
} from "../tools/jules/index_base_tool";
import { Session } from "../tools/jules/types";
import { Env } from "../types";
import { OverseerAgent } from "../agents/team/overseer";

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
  EXTERNAL: "EXTERNAL",
} as const;

// Interaction types for logging
const INTERACTION_TYPE = {
  STATUS_CHECK: "STATUS_CHECK",
  AUTO_APPROVAL: "AUTO_APPROVAL",
  INTERVENTION_NEEDED: "INTERVENTION_NEEDED",
  AGENT_REPLY: "AGENT_REPLY",
  RETROFIT: "RETROFIT",
  ERROR: "ERROR",
} as const;

export class JulesMonitorService {
  private prisma: PrismaClient;
  private julesListSessionsTool: JulesListSessionsTool;
  private julesGetActivityTool: JulesGetActivityTool;
  private julesSendMessageTool: JulesSendMessageTool;
  private env: Env;
  private overseer: OverseerAgent;

  constructor(env: Env) {
    this.env = env;

    // Initialize Prisma with D1 adapter
    const adapter = new PrismaD1(env.DB);
    this.prisma = new PrismaClient({ adapter });

    // Initialize Jules tools
    this.julesListSessionsTool = new JulesListSessionsTool(env);
    this.julesGetActivityTool = new JulesGetActivityTool(env);
    this.julesSendMessageTool = new JulesSendMessageTool(env);

    // Initialize Overseer Agent
    this.overseer = new OverseerAgent(env, {} as any);
  }

  /**
   * Main entry point for cron job - orchestrates sync and health checks
   */
  async run(): Promise<{ synced: number; checked: number; interventions: number }> {
    console.log("🕒 JulesMonitor: Starting sync...");

    // 1. Discover new sessions (Discovery Phase)
    const synced = await this.syncExternalSessions();

    // 2. Sync Active Sessions (Status & Activity Phase)
    await this.runActiveSessionSync();

    // 3. Check for stuck sessions and intervene
    const interventions = await this.checkForStuckSessions();

    console.log(`🕒 JulesMonitor: Complete. External Synced: ${synced}, Interventions: ${interventions}`);

    return { synced, checked: 0, interventions };
  }

  /**
   * Poll external sessions and adopt them if not already tracked
   */
  async syncExternalSessions(): Promise<number> {
    let syncedCount = 0;
    try {
      // Get recent sessions from Jules
      const response = await this.julesListSessionsTool.execute({ pageSize: 20 });
      const externalSessions = response.sessions || [];

      for (const extSession of externalSessions) {
        // Check if we already track this session
        const existing = await this.prisma.julesSession.findUnique({
          where: { id: extSession.id },
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
              updatedAt: new Date(extSession.updateTime),
            },
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
          notIn: ["COMPLETED", "FAILED"],
        },
      },
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
        const remoteSession = await this.julesGetActivityTool.execute({ sessionId: dbSession.id });

        // 3. Status Update Logic
        if (remoteSession.state !== dbSession.status) {
          console.log(`📝 Status Change [${dbSession.id}]: ${dbSession.status} -> ${remoteSession.state}`);
          await this.prisma.julesSession.update({
            where: { id: dbSession.id },
            data: {
              status: remoteSession.state,
              // If closed now, set completedAt
              completedAt: (remoteSession.state === "COMPLETED" || remoteSession.state === "FAILED")
                ? new Date()
                : null,
            },
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
      const response = await this.julesGetActivityTool.execute({ sessionId, pageSize: 10 });
      const activities = response.activities || [];

      for (const act of activities) {
        // Idempotency check using remote_id in metadata
        const remoteId = act.name.split("/").pop(); // Extract activity ID from resource name

        // Check uniqueness in ActivityLog
        // We use metadata string contains for now or exact match if structured
        // Assuming we store it in metadata JSON
        const exists = await this.prisma.activityLog.findFirst({
          where: {
            sessionId: sessionId,
            metadata: { contains: remoteId },
          },
        });

        if (!exists) {
          await this.prisma.activityLog.create({
            data: {
              sessionId: sessionId, // CRITICAL: Link to session
              agent: "Jules",
              action: "REMOTE_UPDATE",
              result: act.description,
              success: true,
              timestamp: new Date(act.createTime),
              metadata: JSON.stringify({
                remote_id: remoteId,
                full_resource: act.name,
                type: "JULES_SYNC",
                original_act: act,
              }),
            },
          });
        }
      }
    } catch (e) {
      console.warn(`Activity sync failed for ${sessionId}`, e);
    }
  }

  /**
   * Checks for stuck sessions and triggers interventions.
   */
  async checkForStuckSessions(): Promise<number> {
    let interventions = 0;
    const stuckSessions = await this.prisma.julesSession.findMany({
      where: {
        status: "WAITING_FOR_USER_FEEDBACK",
      },
    });

    for (const session of stuckSessions) {
      await this.overseer.checkOnJules(session.id);
      interventions++;
    }

    return interventions;
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
        errorMessage: data.errorMessage,
      },
    });
  }
}