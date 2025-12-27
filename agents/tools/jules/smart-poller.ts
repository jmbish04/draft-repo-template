import { JulesClient } from './client';
import { Session, SessionState, Activity } from './types';

export interface SmartPollerOptions {
    /** How often to check session status in ms. Default: 5000 */
    intervalMs?: number;
    /** Max time to wait for completion in ms. Default: 1 hour */
    timeoutMs?: number;
    /** Whether to automatically approve plans. Default: true */
    autoApprove?: boolean;
    /** Custom logger. Default: console.log */
    logger?: (message: string) => void;
}

export type PollResult =
    | { status: 'COMPLETED'; session: Session }
    | { status: 'FAILED'; session: Session; error?: string }
    | { status: 'NEEDS_INPUT'; session: Session; lastMessage?: string }
    | { status: 'TIMEOUT'; session: Session };

export class SmartPoller {
    private client: JulesClient;
    private options: Required<SmartPollerOptions>;

    constructor(client: JulesClient, options: SmartPollerOptions = {}) {
        this.client = client;
        this.options = {
            intervalMs: options.intervalMs || 5000,
            timeoutMs: options.timeoutMs || 60 * 60 * 1000, // 1 hour default
            autoApprove: options.autoApprove ?? true,
            logger: options.logger || console.log,
        };
    }

    /**
     * Monitors a session until it completes, fails, or explicitly requests user input.
     */
    async monitor(sessionId: string): Promise<PollResult> {
        const startTime = Date.now();
        let lastState: SessionState | null = null;

        this.log(`🔍 Monitoring Session: ${sessionId}`);

        while (Date.now() - startTime < this.options.timeoutMs) {
            const session = await this.client.getSession(sessionId);

            // Log state changes
            if (session.state !== lastState) {
                this.log(`  -> State changed: ${session.state}`);
                lastState = session.state;
            }

            switch (session.state) {
                case SessionState.COMPLETED:
                    this.log(`✅ Session Completed Successfully!`);
                    return { status: 'COMPLETED', session };

                case SessionState.FAILED:
                    this.log(`❌ Session Failed.`);
                    return { status: 'FAILED', session };

                case SessionState.AWAITING_PLAN_APPROVAL:
                    if (this.options.autoApprove) {
                        this.log(`⚡ Auto-approving plan...`);
                        await this.client.approvePlan(sessionId);
                        // Don't wait full interval, check immediately
                        await new Promise(r => setTimeout(r, 1000));
                        continue;
                    } else {
                        this.log(`⚠️ Plan requires manual approval.`);
                        return { status: 'NEEDS_INPUT', session };
                    }

                case SessionState.AWAITING_USER_FEEDBACK:
                    // Fetch the latest activity to see what Jules asked
                    const activities = await this.client.listActivities(sessionId, { pageSize: 1 });
                    const lastMsg = activities.activities?.[0]?.agentMessaged?.agentMessage || "Agent is requesting feedback.";

                    this.log(`\n🛑 ---------------------------------------------------`);
                    this.log(`🛑 JULES NEEDS INPUT: "${lastMsg}"`);
                    this.log(`🛑 ---------------------------------------------------\n`);

                    return { status: 'NEEDS_INPUT', session, lastMessage: lastMsg };

                case SessionState.PAUSED:
                    this.log(`⏸️ Session Paused.`);
                    return { status: 'NEEDS_INPUT', session };

                case SessionState.QUEUED:
                case SessionState.PLANNING:
                case SessionState.IN_PROGRESS:
                default:
                    // Just wait
                    break;
            }

            await new Promise(resolve => setTimeout(resolve, this.options.intervalMs));
        }

        this.log(`⏱️ Monitoring timed out.`);
        const finalSession = await this.client.getSession(sessionId);
        return { status: 'TIMEOUT', session: finalSession };
    }

    private log(msg: string) {
        this.options.logger(`[JulesPoller] ${msg}`);
    }
}
