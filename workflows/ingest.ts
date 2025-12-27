
/**
 * -----------------------------------------------------------------------------
 * FILE: ingest.ts
 * MODULE: Workflows
 * -----------------------------------------------------------------------------
 * DESCRIPTION:
 * The "Decision Engine" workflow. It ingests prompts, classifies intent via
 * StrategyAgent, and either routes to immediate execution or triggers the
 * AdvisorWorkflow for deep research.
 * -----------------------------------------------------------------------------
 */

import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { Env } from '../types';
import { IngestPayload } from './types';

export class IngestWorkflow extends WorkflowEntrypoint<Env, IngestPayload> {
    async run(event: WorkflowEvent<IngestPayload>, step: WorkflowStep) {
        const payload = event.payload;

        // Step 1: Strategy Assessment (REMOVED - StrategyAgent deprecated)
        // We default intent to UNKNOWN and let Advisor/Expert handle it.
        const intent = "UNKNOWN";

        // Step 2: Get Specialist Advice (Advisor Workflow)
        const advisorId = crypto.randomUUID();
        const advice = await step.do("seek_advice", async () => {
            // Trigger AdvisorWorkflow
            await this.env.ADVISOR_WORKFLOW.create({
                id: `advisor-${advisorId}`,
                params: {
                    prompt: payload.rawPrompt,
                    intent: intent,
                    projectContext: payload.sourceContext // Pass full source context
                }
            });

            // We can't easily await the *result* of another workflow instance here without polling.
            // For MVP, we'll assume the Advisor Workflow updates the DB or notifies via other means.
            // OR: We can just run the logic inline if we wanted, but the prompt asked for separate workflows.

            return { status: "ADVISOR_STARTED", workflowId: `advisor-${advisorId}` };
        });

        // Step 3: Submit for Human Verification
        await step.do("submit_for_review", async () => {
            // ... (Verification Agent submission)
            const vId = this.env.VERIFICATION_AGENT.idFromName("gatekeeper");
            const vStub = this.env.VERIFICATION_AGENT.get(vId);

            await vStub.fetch("http://internal/submit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    originalUserRequest: payload.rawPrompt,
                    // We pass the strategy intent. Real plan comes from Advisor later.
                    enhancedContext: {
                        bindings: [],
                        techStack: [],
                        constraints: [intent], // Use default intent
                        documentation: []
                    },
                    generatedJulesPrompt: `(Pending Advisor Output) - Intent: ${intent}`
                })
            });

            return { success: true };
        });

        return {
            status: "PROCESSING",
            advisor: advice
        };
    }
}
