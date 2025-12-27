
import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';

export class AdvisorWorkflow extends WorkflowEntrypoint<any, any> {
    async run(event: WorkflowEvent<any>, step: WorkflowStep) {
        await step.do('stub', async () => {
            console.log("AdvisorWorkflow stub running");
        });
    }
}

export class IngestWorkflow extends WorkflowEntrypoint<any, any> {
    async run(event: WorkflowEvent<any>, step: WorkflowStep) {
        await step.do('stub', async () => {
            console.log("IngestWorkflow stub running");
        });
    }
}
