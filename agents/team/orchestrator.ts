import { BaseAgent, AgentState } from "../core/base";

export interface OrchestratorState extends AgentState {
  // Add any specific state for the OrchestratorAgent
}

export class OrchestratorAgent extends BaseAgent<Env, OrchestratorState> {
  agentName = "OrchestratorAgent";

  defineTools() {
    return {};
  }
}