import { BaseAgent, AgentState } from "../core/base";
import {
  CfWorkerListTool,
  CfKvListTool,
} from "../tools/cloudflare-mcp/bindings/index_base_tool";
import { GithubListFilesTool } from "../tools/github/index_base_tool";

export interface ArchitectState extends AgentState {
  // Add any specific state for the ArchitectAgent
}

export class ArchitectAgent extends BaseAgent<Env, ArchitectState> {
  agentName = "ArchitectAgent";

  defineTools() {
    return {
      cfWorkerList: new CfWorkerListTool(this.env),
      cfKvList: new CfKvListTool(this.env),
      githubListFiles: new GithubListFilesTool(this.env),
    };
  }

  async generateArchitectureMap(owner: string, repo: string) {
    const workers = await this.tools.cfWorkerList.execute({});
    const kvs = await this.tools.cfKvList.execute({});
    const files = await this.tools.githubListFiles.execute({ owner, repo });

    const architectureMap = `
# Architecture Map

## Cloudflare Resources

### Workers

${workers.result.map((worker: any) => `- ${worker.id}`).join("\n")}

### KV Namespaces

${kvs.result.map((kv: any) => `- ${kv.title}`).join("\n")}

## GitHub Repository Files

${files.map((file: any) => `- ${file.path}`).join("\n")}
`;

    return architectureMap;
  }
}