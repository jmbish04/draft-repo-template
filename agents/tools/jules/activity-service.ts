import { JulesClient } from "./client";
import { Activity, Session } from "./types";

export interface DashboardActivity {
    source: 'JULES_API' | 'BABYSITTER_LOG';
    id: string;
    timestamp: string;
    description: string;
    action: string;
    result: string;
    agent?: string;
    meta?: any;
    sessionId?: string;
    sessionTitle?: string;
}

export interface DashboardStats {
    active_sessions: {
        id: string;
        title?: string;
        status: string;
        last_activity: string;
        pr_link?: string;
    }[];
    needs_attention: {
        id: string;
        title?: string;
        reason: string;
        last_activity: string;
    }[];
    pending_prs: {
        title: string;
        url: string;
        status: string;
        repo: string;
        number: number;
        updated_at: string;
    }[];
    recent_issues: {
        title: string;
        url: string;
        status: string;
        repo: string;
        number: number;
        updated_at: string;
    }[];
    recent_actions: {
        title: string;
        url: string;
        status: string;
        repo: string;
        branch: string;
        updated_at: string;
    }[];
}

export class JulesActivityService {
    constructor(private client: JulesClient, private db?: any, private env?: any) { }

    /**
     * Aggregates recent activity purely from the DB (synced by Monitor) to save API quota.
     * READ-ONLY from D1 (Zero Jules API Cost)
     */
    async getUnifiedRecentActivity(limit: number = 20): Promise<{ data: DashboardActivity[], meta: any }> {
        if (!this.db) return { data: [], meta: {} };

        try {
            const logs = await this.db.activityLog.findMany({
                orderBy: { timestamp: 'desc' },
                take: limit
            });

            // Map DB logs to Dashboard format
            const data = logs.map((log: any) => {
                let desc = log.result || log.activityType || "No details";
                let action = log.action || "UNKNOWN";

                if (desc.includes("Generated")) action = "AI_RESPONSE";
                else if (desc.includes("Used tool")) {
                    const match = desc.match(/Used tool '([^']+)'/);
                    action = match ? `TOOL: ${match[1].toUpperCase()}` : "TOOL_EXECUTION";
                }

                return {
                    source: 'BABYSITTER_LOG',
                    id: `db-${log.id}`,
                    timestamp: log.timestamp.toISOString ? log.timestamp.toISOString() : log.timestamp,
                    description: desc,
                    action: action,
                    result: desc,
                    agent: log.agent,
                    sessionId: log.sessionId,
                    meta: log.metadata
                } as DashboardActivity;
            });

            let lastSync = new Date().toISOString();

            if (this.env && this.env.KV) {
                const kvCheck = await this.env.KV.get("DASHBOARD_LAST_SYNC");
                if (kvCheck) lastSync = kvCheck;
            }

            const lastSyncTime = new Date(lastSync).getTime();
            const now = Date.now();

            return {
                data,
                meta: {
                    cache_age_ms: now - lastSyncTime,
                    next_refresh_in_ms: (5 * 60 * 1000) - (now - lastSyncTime),
                    last_sync: lastSync
                }
            };
        } catch (e) {
            console.error("Failed to fetch DB activity", e);
            return { data: [], meta: { error: String(e) } };
        }
    }

    /**
     * Aggregates stats for the dashboard: Active Sessions, Needs Attention, Pending PRs, Issues, and Actions.
     */
    async getDashboardStats(env: any, days: number = 5): Promise<DashboardStats> {
        const stats: DashboardStats = {
            active_sessions: [],
            needs_attention: [],
            pending_prs: [],
            recent_issues: [],
            recent_actions: []
        };

        const OWNERS = ['jmbish04'];
        const date = new Date();
        date.setDate(date.getDate() - days);
        const sinceDate = date.toISOString().split('T')[0];

        try {
            // 1. Fetch active Jules sessions
            try {
                // Use Client or cached sessions if available. Sticking to client cautiously for now but wrapping error.
                // Ideally this should also be cached.
                const sessionsRes = await this.client.listSessions({ pageSize: 20 });
                const sessions = sessionsRes.sessions || [];

                for (const session of sessions) {
                    if (session.state === "FAILED" || session.state === "STATE_UNSPECIFIED") {
                        stats.needs_attention.push({
                            id: session.id,
                            title: session.title,
                            reason: "Session failed or unspecified",
                            last_activity: session.updateTime || new Date().toISOString()
                        });
                    } else if (session.state !== "COMPLETED") {
                        stats.active_sessions.push({
                            id: session.id,
                            title: session.title,
                            status: session.state || "IN_PROGRESS",
                            last_activity: session.updateTime || new Date().toISOString()
                        });
                    }
                }
            } catch (e) {
                console.warn("Failed to fetch Jules sessions", e);
            }

            // 2. Global GitHub Search (PRs & Issues) & Actions
            if (env.GITHUB_TOKEN) {
                try {
                    const { getOctokit } = await import("../github/core");
                    const octokit = getOctokit(env);

                    // --- Search Queries ---
                    const generalQuery = `user:${OWNERS[0]} updated:>${sinceDate}`;
                    const reviewQuery = `review-requested:${OWNERS[0]} state:open`;
                    const myPrsQuery = `author:${OWNERS[0]} is:pr state:open`;

                    const [generalItems, reviewItems, myPrs] = await Promise.all([
                        octokit.rest.search.issuesAndPullRequests({ q: generalQuery, per_page: 20 }).then(r => r.data.items).catch(() => []),
                        octokit.rest.search.issuesAndPullRequests({ q: reviewQuery, per_page: 10 }).then(r => r.data.items).catch(() => []),
                        octokit.rest.search.issuesAndPullRequests({ q: myPrsQuery, per_page: 10 }).then(r => r.data.items).catch(() => [])
                    ]);

                    const allItems = [...generalItems, ...reviewItems, ...myPrs];
                    const activeRepos = new Set<string>();
                    const seenUrls = new Set();

                    for (const item of allItems) {
                        if (seenUrls.has(item.html_url)) continue;
                        seenUrls.add(item.html_url);

                        const repoMatch = item.html_url.match(/github\.com\/([^\/]+\/[^\/]+)/);
                        const repoName = repoMatch ? repoMatch[1] : "unknown";
                        if (repoName !== "unknown") activeRepos.add(repoName);

                        const entry = {
                            title: item.title,
                            url: item.html_url,
                            status: item.state,
                            repo: repoName,
                            number: item.number,
                            updated_at: item.updated_at
                        };

                        if (item.pull_request) {
                            stats.pending_prs.push(entry);
                            const reasons: string[] = [];
                            const ageDays = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 3600 * 24);

                            const isReviewRequested = reviewItems.some((p: any) => p.id === item.id);
                            const isCopilotAuthor = item.user?.login === "Copilot" || item.user?.login === "github-actions[bot]";

                            if (isReviewRequested) {
                                reasons.push(isCopilotAuthor ? "🤖 Copilot awaiting review" : "👀 Review requested");
                            }

                            if (reasons.length === 0 && item.state === "open" && ageDays > 7) {
                                reasons.push(`⚠️ Stale (${Math.floor(ageDays)}d)`);
                            }

                            if (reasons.length > 0) {
                                stats.needs_attention.push({
                                    id: `github-${item.id}`,
                                    title: item.title,
                                    reason: reasons.join(", "),
                                    last_activity: item.updated_at
                                });
                            }
                        } else {
                            stats.recent_issues.push(entry);
                        }
                    }

                    // --- Fetch Actions ---
                    const reposToCheck = Array.from(activeRepos).slice(0, 3);
                    if (reposToCheck.length === 0) reposToCheck.push("jmbish04/jules-mcp");

                    const actionPromises = reposToCheck.map(async (repoFullName) => {
                        try {
                            const [owner, repo] = repoFullName.split('/');
                            if (!owner || !repo) return [];
                            const { data: runs } = await octokit.rest.actions.listWorkflowRunsForRepo({
                                owner, repo, per_page: 5, created: `>${sinceDate}`
                            });
                            return runs.workflow_runs.map((run: any) => ({
                                title: run.name,
                                url: run.html_url,
                                status: run.conclusion || run.status,
                                repo: repoFullName,
                                branch: run.head_branch,
                                updated_at: run.updated_at
                            }));
                        } catch (e: any) {
                            return [];
                        }
                    });

                    const actions = (await Promise.all(actionPromises)).flat();
                    stats.recent_actions = actions;

                    stats.pending_prs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
                    stats.recent_issues.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
                    stats.recent_actions.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

                } catch (ghError: any) {
                    console.error(`Failed to execute GitHub search: ${ghError.message}`);
                }
            }
        } catch (e) {
            console.error("Failed to fetch dashboard stats", e);
        }

        return stats;
    }

    async logCheckIn(type: string, message: string, meta: any = {}) {
        if (!this.db) return;
        try {
            await this.db.activityLog.create({
                data: {
                    agent: "JulesTool",
                    action: type,
                    result: message,
                    metadata: meta ? JSON.stringify(meta) : undefined,
                    success: true,
                    timestamp: new Date()
                }
            });
        } catch (e) {
            console.error("Failed to log check-in", e);
        }
    }

    async getJulesGlobalActivity(limit: number = 10): Promise<DashboardActivity[]> {
        return []; // Deprecated
    }

    private async getDbActivity(limit: number = 20): Promise<DashboardActivity[]> {
        // Redundant but kept for internal signature compat if needed
        return [];
    }
}
