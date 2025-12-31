import { BaseAgent, AgentState } from "./base";

export interface DashboardState extends AgentState {
  // Add any specific state for the DashboardAgent
}

export class DashboardAgent extends BaseAgent<Env, DashboardState> {
  agentName = "DashboardAgent";

  defineTools() {
    return {};
  }
}