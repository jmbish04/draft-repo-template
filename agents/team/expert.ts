import { BaseAgent, AgentState } from "../core/base";
import {
  ContainerExecTool,
  ContainerFileWriteTool,
} from "../tools/sandbox";
import { GithubPushFileTool } from "../tools/github/index_base_tool";
import { JulesCreateSessionTool } from "../tools/jules/index_base_tool";

export interface ExpertState extends AgentState {
  // Add any specific state for the ExpertAgent
}

export class ExpertAgent extends BaseAgent<Env, ExpertState> {
  agentName = "ExpertAgent";

  defineTools() {
    return {
      sandboxExec: new ContainerExecTool(this.env),
      sandboxWriteFile: new ContainerFileWriteTool(this.env),
      githubPushFile: new GithubPushFileTool(this.env),
      julesCreateSession: new JulesCreateSessionTool(this.env),
    };
  }
}