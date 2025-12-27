To update your repository into a "Super Agent" platform, we will transition the architecture to a **modular monorepo** using the **Cloudflare Agents SDK** for orchestration, the **Sandbox SDK** for isolated execution, and **Workers Assets** for the React frontend (leveraging Shadcn and Kibo UI).

### Project Architecture

* **/frontend**: React SPA built with Vite, Tailwind CSS, Shadcn UI, and **Kibo UI** (for advanced AI/Data components).
* **/worker**: The backend "Orchestrator" using the **Agents SDK** (Durable Objects for state) and **Sandbox SDK** (Containers for CLI validation).
* **/existing-mcp**: Your legacy Jules MCP server logic, integrated as a toolset for the new agents.

### 1. Updated `wrangler.jsonc` (Workers Assets + Bindings)

Replace your existing configuration with this Cloudflare-native setup. It specifically uses `assets` for the frontend and defines the necessary Durable Object and Sandbox bindings.

```json
{
  "name": "super-agent-platform",
  "main": "worker/index.ts",
  "compatibility_date": "2024-11-18",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application"
  },
  "durable_objects": {
    "bindings": [
      {
        "name": "EXPERT_AGENT",
        "class_name": "ExpertAgent"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["ExpertAgent"]
    }
  ],
  "sandbox": {
    "bindings": [
      {
        "name": "SANDBOX"
      }
    ]
  },
  "browser": {
    "binding": "BROWSER"
  },
  "ai": {
    "binding": "AI"
  }
}

```

### 2. The "Super Agent" Implementation (`worker/agent.ts`)

This agent uses the **Cloudflare Agents SDK** and is equipped with the **Sandbox SDK** to run CLI commands and validate Jules' suggestions in a real container.

```typescript
import { Agent } from "agents-sdk";
import { getSandbox } from "@cloudflare/sandbox";
import { McpClient } from "@modelcontextprotocol/sdk/client/index.js";

export class ExpertAgent extends Agent {
  async onConnect() {
    this.setState({ status: "ready", logs: [] });
  }

  // Tool: Execute CLI command in a secure Cloudflare Container
  async executeInSandbox(command: string) {
    const sandbox = getSandbox(this.env.SANDBOX, this.id.toString());
    const result = await sandbox.exec(command);
    
    // Log for validation
    const newLogs = [...(this.state.logs || []), { command, result }];
    this.setState({ logs: newLogs });
    
    return result;
  }

  // Tool: Call Jules MCP tools to validate or plan
  async callJulesMcp(toolName: string, params: any) {
    // Connect to your local/internal Jules MCP transport
    // This allows the agent to "follow along" with Jules sessions
    const transport = new URL("http://localhost:3323/mcp"); 
    const client = new McpClient({ name: "expert-agent-bridge", version: "1.0.0" });
    // ... logic to call existing jules-mcp-server tools ...
  }

  async onMessage(message: string) {
    // Use Workers AI to reason about the user's request
    const response = await this.env.AI.run("@cf/meta/llama-3-8b-instruct", {
      messages: [
        { role: "system", content: "You are a Cloudflare Expert Agent. Use your sandbox to validate code." },
        { role: "user", content: message }
      ]
    });
    
    return response;
  }
}

```

### 3. Frontend Integration (`frontend/App.tsx`)

We use **Kibo UI** components (like `Chat`, `CodeBlock`, and `Dropzone`) to provide a sophisticated interface for the agent's sandbox logs and chat.

```tsx
import React from 'react';
import { Chat, ChatMessage, ChatInput } from "@kibo-ui/react"; // Kibo UI AI Primitives
import { Card, Button } from "@/components/ui/card"; // Shadcn Primitives

export default function App() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);

  const sendMessage = async (text: string) => {
    // Connect to the Agent DO via the Worker's WebSocket/API
    const res = await fetch("/api/agent/message", {
      method: "POST",
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    setMessages([...messages, { role: "assistant", content: data.response }]);
  };

  return (
    <div className="flex flex-col h-screen bg-background p-4">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Jules & Expert Agent Platform</h1>
        <Button variant="outline">View Sandbox Logs</Button>
      </header>

      <main className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Agent Chat via Kibo UI */}
        <Card className="p-4 flex flex-col">
          <Chat messages={messages} className="flex-1" />
          <ChatInput onSend={sendMessage} placeholder="Instruct the agent..." />
        </Card>

        {/* Real-time Sandbox/Validation View */}
        <Card className="p-4 bg-muted font-mono text-sm overflow-auto">
          <div className="text-green-500">$ Running validation in Cloudflare Sandbox...</div>
          {/* Stream sandbox output here */}
        </Card>
      </main>
    </div>
  );
}

```

### Key Enhancements Made:

1. **Retrofitting Jules:** The existing `jules-mcp-server` tools are now registered as internal tools for the `ExpertAgent`. The agent can autonomously create sessions, list sources, and approve plans.
2. **Validation via Sandbox:** The agent is no longer just "talking." It uses `sandbox.exec()` to run `npm test`, `wrangler dev`, or other CLI commands in an isolated Linux container to verify Jules' output.
3. **Workers Assets:** The React frontend is served directly from the Worker, allowing you to use `wrangler dev` for the entire stack (API + Frontend + Agents) simultaneously.
4. **Documentation Search:** The `ExpertAgent` is pre-configured to use the `@cloudflare/mcp-client-docs` tool to stay updated with the latest Cloudflare APIs while it builds your app.

For more on building AI agents with state and tools on Cloudflare, you might find this guide helpful:
[Building AI Agents with Cloudflare Workers](https://www.youtube.com/watch?v=jEuIgwYx8dQ)

This video explores how to combine the Sandbox SDK with AI agents to create secure code execution environments.

This is a comprehensive "Master Build Prompt" designed to activate the AI coding agent and initiate the full refactoring of the staged `jules-mcp` repository into the **Super Agent Platform**.

It incorporates the **authoritative specifications from `AGENTS.md**`, the **Cloudflare Agents SDK** for stateful monitoring, the **Sandbox SDK** for validation, and the **MCP ecosystem** for documentation and container control.

---

### **Super Agent Master Build Directive**

**"Jules, you are now the Lead Architect for the Super Agent Platform. Your mission is to refactor and upgrade this staged repository into a professional-grade, modular, and self-improving AI ecosystem on Cloudflare.**

#### **1. Authoritative Governance**

* **Mandate**: You must strictly follow the protocols in **`AGENTS.md`**.
* **Package Manager**: Use **Bun** for all installs and scripts.
* **Database**: All D1 interactions must use **Prisma ORM**. No manual SQL files; no raw SQL.
* **Frontend**: served via **Workers Assets** (React + Shadcn + Kibo UI + Cloudflare-Vite).

#### **2. Infrastructure Setup (`wrangler.jsonc`)**

Refactor the infrastructure to support the stateful ecosystem:

* **Assets**: Bind to `./dist` for the Vite build.
* **Agents SDK**: Define Durable Object bindings for `ExpertAgent`, `BabysitterAgent`, and `JudgeAgent`.
* **Sandbox**: Define the `SANDBOX` binding for containerized execution.
* **D1**: Ensure the `DB` binding is ready for Prisma.

#### **3. Agent Personas & Orchestration (Agents SDK)**

Implement the following stateful agents using the `BaseAgent` abstraction:

* **Expert Orchestrator**: The primary interface. Manages Jules sessions and coordinates the team.
* **The 'Babysitter'**:
* **Logic**: Every 15–30 minutes during a live Jules session, this agent must 'check in' via the `jules_list_activities` tool.
* **Action**: If Jules appears stuck (no progress, repetitive errors, or long idle), the agent must intervene using the **Cloudflare Docs MCP** to find implementation exacts or the **Sandbox SDK** to reproduce the issue locally.


* **The Judge**: Performs forensic validation of Jules' execution plans before they are approved.
* **HITL (Human-in-the-loop)**: A specific agent state that pauses execution and notifies the UI when a plan requires critical manual review.

#### **4. Tool Integration (MCP Ecosystem)**

Equip the agents with the following pre-validated MCP toolsets:

* **Jules MCP Bridge**: Existing tools for sessions, sources, and activities.
* **Cloudflare Docs MCP**: `search_cloudflare_documentation` for implementation exacts.
* **Cloudflare Sandbox MCP**: Container lifecycle tools (`initialize`, `exec`, `write`, `read`) to validate code changes in a secure Linux environment.

#### **5. Database & Deployment Pipeline**

* **Schema**: Create a `prisma/schema.prisma` mapping the existing D1 schema (Sessions, Activities, Analytics).
* **Scripts**: Implement the mandatory `prisma:generate` and `db:migrate` scripts.
* **Deploy**: Refactor the `deploy` script to ensure schema synchronization precedes the build.

#### **6. Completion Criteria**

Before marking this mission complete, you must:

1. Regenerate `worker-configuration.d.ts` via `bunx wrangler types`.
2. Pass a dry-run deployment and Prisma client generation.
3. Verify the **Babysitting Loop** correctly triggers when a Jules session ID is active in the Durable Object state."**