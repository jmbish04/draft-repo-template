
/**
 * -----------------------------------------------------------------------------
 * FILE: advisor.ts
 * MODULE: Workflows
 * -----------------------------------------------------------------------------
 * DESCRIPTION:
 * The "Research Team" workflow. Orchestrates multiple agents to prepare a 
 * comprehensive technical plan before any code is written.
 * 
 * AGENTS INVOLVED:
 * 1. ArchitectAgent: Maps infrastructure and bindings
 * 2. ExpertAgent: Fetches documentation and best practices
 * 3. JudgeAgent: Validates the plan against the user request
 * -----------------------------------------------------------------------------
 */

import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { Env } from '../types';
import { AdvisorPayload, AdvisorResult } from './types';

export class AdvisorWorkflow extends WorkflowEntrypoint<Env, AdvisorPayload> {
    async run(event: WorkflowEvent<AdvisorPayload>, step: WorkflowStep) {
        const { prompt, intent } = event.payload;

        // 1. Architect: Map Reality and Bindings
        // Task: "Analyze the sourceContext (GitHub) and cloudflare-bindings (MCP). Map out the current infrastructure (D1, KV, Workers)."
        const infraContext = await step.do('architect_scan', async () => {
            const id = this.env.ARCHITECT_AGENT.idFromName('advisor');
            const stub = this.env.ARCHITECT_AGENT.get(id);
            const res = await stub.fetch('http://internal/task', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'ANALYZE_INFRA',
                    payload: { prompt }
                })
            });
            return await res.json() as any;
        });

        // 2. Expert: Fetch Knowledge
        // Task: "Based on the user's prompt keywords, use conductDeepResearch to fetch relevant Cloudflare documentation snippets."
        const research = await step.do('expert_research', async () => {
            const id = this.env.EXPERT_AGENT.idFromName('researcher');
            const stub = this.env.EXPERT_AGENT.get(id);
            const res = await stub.fetch('http://internal/task', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'DEEP_RESEARCH',
                    payload: { topic: prompt }
                })
            });
            return await res.json() as any; // Returns doc snippets
        });

        // 3. Draft Synthesis (In-memory step)
        // Combine Architect's map and Expert's docs into a Draft Plan structure for the Judge
        const draftPlan = {
            userRequest: prompt,
            infraContext,
            research,
            intent
        };

        // 4. Judge: Quality Gate
        // Task: "Review this Draft Plan against the User Prompt. Is it hallucinating bindings? Is the syntax up to date? Rate it 0-100."
        const critique: any = await step.do('judge_review', async () => {
            const id = this.env.JUDGE_AGENT.idFromName('quality-gate');
            const stub = this.env.JUDGE_AGENT.get(id);
            const res = await stub.fetch('http://internal/task', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'EVALUATE_PLAN',
                    payload: { plan: draftPlan }
                })
            });
            return await res.json() as any;
        });

        // 5. Refinement (Optional loop logic here)
        // For now, we just pass the critique along with the result

        return {
            enhancedPrompt: `CONTEXT:\n${JSON.stringify(infraContext, null, 2)}\n\nDOCS:\n${JSON.stringify(research, null, 2)}\n\nTASK:\n${prompt}\n\nWARNINGS:\n${(critique.issues || []).join('\n')}`,
            technicalContext: infraContext,
            qualityScore: critique.score || 0
        } as AdvisorResult;
    }
}
