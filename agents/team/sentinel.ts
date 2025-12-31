import { BaseAgent, AgentState } from "../core/base";

export interface SentinelState extends AgentState {
  // Add any specific state for the SentinelAgent
}

export class SentinelAgent extends BaseAgent<Env, SentinelState> {
  agentName = "SentinelAgent";

  defineTools() {
    return {};
  }
}