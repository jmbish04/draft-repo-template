import { BaseAgent, AgentState } from "../core/base";
import {
  JulesListSessionsTool,
  JulesSendMessageTool,
  JulesGetActivityTool,
} from "../tools/jules/index_base_tool";
import { CfD1QueryTool } from "../tools/cloudflare-mcp/bindings/index_base_tool";
import { CloudflareDocsTool } from "../tools/cloudflare-mcp/docs/index_base_tool";

export interface OverseerState extends AgentState {
  // Add any specific state for the OverseerAgent
}

export class OverseerAgent extends BaseAgent<Env, OverseerState> {
  agentName = "OverseerAgent";

  defineTools() {
    return {
      julesListSessions: new JulesListSessionsTool(this.env),
      julesSendMessage: new JulesSendMessageTool(this.env),
      julesGetActivity: new JulesGetActivityTool(this.env),
      cfD1Query: new CfD1QueryTool(this.env),
      cloudflareDocs: new CloudflareDocsTool(this.env),
    };
  }

  async checkOnJules(sessionId: string): Promise<string | null> {
    const activity = await this.tools.julesGetActivity.execute({ sessionId });

    // Check for "stuck" state
    const lastActivity = activity.activities[activity.activities.length - 1];
    if (lastActivity?.agentMessaged?.agentMessage && (/�(error|stuck)�/i.test(lastActivity.agentMessaged.agentMessage))) {
      const query = `How to fix error in Jules session: ${lastActivity.agentMessaged.agentMessage}`;
      const searchResults = await this.tools.cloudflareDocs.execute({ query });
      const solution = searchResults[0]?.content;
      if (solution) {
        await this.tools.julesSendMessage.execute({ sessionId, prompt: solution });
        return solution;
      }
    }

    return null;
  }
}