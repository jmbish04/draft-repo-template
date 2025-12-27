# Jules MCP Server (Cloudflare Workers)

[![npm version](https://img.shields.io/npm/v/jules-mcp-server.svg)](https://npmjs.org/package/jules-mcp-server)

`jules-mcp-server` connects your AI coding assistant (such as Claude, Cursor, or Copilot) to the [Jules API](https://jules.ai), enabling autonomous coding sessions directly from your IDE. This version is deployed as a **Cloudflare Worker** for always-on, globally distributed access.

## [Deployment Guide](./DEPLOYMENT.md) | [D1 Logging](./D1_LOGGING.md) | [Changelog](./CHANGELOG.md)

## Key features

- ✅ **Always-on**: Deployed to Cloudflare Workers - no local server required
- ✅ **Globally distributed**: Low-latency access from anywhere
- ✅ **Secure**: Token-based authentication with configurable access control
- ✅ **Comprehensive logging**: D1 database tracks all requests, sessions, and Jules interactions
- ✅ **Autonomous coding sessions**: Create and manage Jules coding sessions directly from your AI assistant
- ✅ **GitHub integration**: Connect to your GitHub repositories through Jules sources
- ✅ **Plan approval workflow**: Review and approve execution plans before Jules makes changes
- ✅ **Real-time activity tracking**: Monitor session progress and view detailed activity logs
- ✅ **Type-safe validation**: Runtime validation with Zod ensures all inputs are validated before API calls
- ✅ **Streamable HTTP transport**: Uses the MCP Streamable HTTP specification for reliable communication

## Disclaimers

`jules-mcp-server` provides your MCP client with access to create and manage coding sessions in your connected GitHub repositories. Ensure you review and approve plans before execution, especially in production repositories. The server requires a valid Jules API key with appropriate permissions.

## Requirements

- [Cloudflare Account](https://dash.cloudflare.com/sign-up) (free tier works)
- [Jules API account](https://developers.google.com/jules/api) with API key
- [Node.js](https://nodejs.org/) v18 or newer
- [npm](https://www.npmjs.com/)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Authenticate with Cloudflare

```bash
npx wrangler login
```

### 3. Set Your Secrets

```bash
# Required: Your Jules API key
npx wrangler secret put JULES_API_KEY

# Recommended: Authentication token for MCP endpoint
npx wrangler secret put MCP_AUTH_TOKEN
# Generate a secure token with: openssl rand -hex 32
```

### 4. Deploy to Cloudflare Workers

```bash
npm run deploy
```

Your worker will be deployed to: `https://jules-mcp.<your-subdomain>.workers.dev`

### 5. Configure Your MCP Client

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "jules": {
      "url": "https://jules-mcp.<subdomain>.workers.dev/mcp",
      "transport": {
        "type": "streamable-http",
        "headers": {
          "Authorization": "Bearer <your-mcp-auth-token>"
        }
      }
    }
  }
}
```

> [!IMPORTANT]
> Replace `<subdomain>` with your actual Cloudflare Workers subdomain and `<your-mcp-auth-token>` with the token you set in step 3.

### 6. Test the Connection

```bash
curl https://jules-mcp.<subdomain>.workers.dev/health
```

Should return:
```json
{
  "ok": true,
  "service": "jules-mcp",
  "version": "0.3.0",
  "timestamp": "2025-12-19T10:30:00.000Z"
}
```

## Endpoints

### `/mcp` - MCP Streamable HTTP Endpoint

Main endpoint for Model Context Protocol communication.

**Authentication Required:**
- Header: `Authorization: Bearer <MCP_AUTH_TOKEN>`
- Or: `x-mcp-auth: <MCP_AUTH_TOKEN>`

### `/health` - Health Check

Returns server status and version (no authentication required).

## Development

### Local Development

Run the worker locally (requires secrets to be set):

```bash
npm run dev
```

This starts a local server at `http://localhost:8787`

### View Live Logs

Stream real-time logs from your deployed worker:

```bash
npm run tail
```

### Update Deployment

After making code changes:

```bash
npm run deploy
```

## MCP Client Configuration

<details>
  <summary>Claude Desktop</summary>

Edit your Claude Desktop configuration file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add the Jules server configuration:

```json
{
  "mcpServers": {
    "jules": {
      "url": "https://jules-mcp.<subdomain>.workers.dev/mcp",
      "transport": {
        "type": "streamable-http",
        "headers": {
          "Authorization": "Bearer <your-mcp-auth-token>"
        }
      }
    }
  }
}
```

Restart Claude Desktop after saving the configuration.

</details>

<details>
  <summary>Cursor</summary>

1. Go to `Cursor Settings` → `Features` → `MCP`
2. Click `Add new global MCP server`
3. Add the configuration:

```json
{
  "mcpServers": {
    "jules": {
      "url": "https://jules-mcp.<subdomain>.workers.dev/mcp",
      "transport": {
        "type": "streamable-http",
        "headers": {
          "Authorization": "Bearer <your-mcp-auth-token>"
        }
      }
    }
  }
}
```

4. Restart Cursor

> [!NOTE]
> The server uses stateless mode for optimal Cursor compatibility.

</details>

<details>
  <summary>Google AI Studio / Gemini</summary>

```json
{
  "mcp_servers": {
    "jules": {
      "endpoint": "https://jules-mcp.<subdomain>.workers.dev/mcp",
      "headers": {
        "x-mcp-auth": "<your-mcp-auth-token>"
      }
    }
  }
}
```

</details>

<details>
  <summary>Other MCP Clients</summary>

For other MCP clients that support Streamable HTTP transport, ensure the client supports:

- MCP protocol version `2024-11-05` or newer
- Streamable HTTP transport (`type: "streamable-http"`)
- Custom headers for authentication
- Stateless mode (no session management required)

</details>

## Tools

All tools include runtime validation with Zod for type safety and clear error messages.

<!-- BEGIN TOOLS LIST -->

* **Session management** (3 tools)
  * `jules_create_session` - Create a new Jules coding session
  * `jules_list_sessions` - List all your Jules sessions
  * `jules_send_message` - Send a message to an active Jules agent

* **Plan approval** (1 tool)
  * `jules_approve_plan` - Approve a session's execution plan

* **Monitoring** (2 tools)
  * `jules_list_sources` - List your connected GitHub sources
  * `jules_list_activities` - List activities for a session

<!-- END TOOLS LIST -->

### Tool details

#### `jules_list_sources`
List your connected GitHub sources.

**Parameters:**
- `pageSize` (optional): Number of items per page (1-100)
- `pageToken` (optional): Token for pagination

#### `jules_create_session`
Create a new Jules coding session.

**Parameters:**
- `prompt` (required): The task prompt for Jules (1-10000 characters)
- `source` (required): Source path, e.g., `sources/github/owner/repo`
- `title` (optional): Session title (1-200 characters)
- `startingBranch` (optional): Git branch to start from (default: `main`)
- `requirePlanApproval` (optional): Whether to require plan approval before execution (default: `false`)

#### `jules_list_sessions`
List all your Jules sessions.

**Parameters:**
- `pageSize` (optional): Number of items per page (1-100)
- `pageToken` (optional): Token for pagination

#### `jules_approve_plan`
Approve a session's execution plan.

**Parameters:**
- `sessionId` (required): The session ID to approve, format: `sessions/{id}`

#### `jules_send_message`
Send a message to an active Jules agent.

**Parameters:**
- `sessionId` (required): The session ID, format: `sessions/{id}`
- `prompt` (required): The message to send (1-10000 characters)

#### `jules_list_activities`
List activities for a session.

**Parameters:**
- `sessionId` (required): The session ID, format: `sessions/{id}`
- `pageSize` (optional): Number of items per page (1-100)
- `pageToken` (optional): Token for pagination

## Resources

The server provides two MCP resources for additional context:

* **`jules://sources`** - Your connected GitHub sources
* **`jules://sessions/{id}/activities`** - Latest activities for a specific session

Resources can be accessed directly by MCP clients for context gathering.

## Configuration

The server is configured via Cloudflare Workers secrets and environment variables.

### Secrets (Set via Wrangler)

```bash
# Required
npx wrangler secret put JULES_API_KEY

# Recommended (for authentication)
npx wrangler secret put MCP_AUTH_TOKEN
```

### Environment Variables (wrangler.toml)

* **`AUTH_DISABLED`**
  Disable authentication (not recommended for production)
  * **Type:** string ("true" or "false")
  * **Default:** `"false"`

## Security

### Authentication

The worker supports two authentication methods:

1. **Bearer Token** (recommended):
   ```
   Authorization: Bearer <MCP_AUTH_TOKEN>
   ```

2. **Custom Header**:
   ```
   x-mcp-auth: <MCP_AUTH_TOKEN>
   ```

### Best Practices

1. ✅ Always set `MCP_AUTH_TOKEN` in production
2. ✅ Use strong random tokens: `openssl rand -hex 32`
3. ✅ Rotate credentials regularly
4. ✅ Monitor access via `npm run tail`
5. ✅ Never commit secrets to version control
6. ❌ Don't set `AUTH_DISABLED=true` in production

## Architecture

### Cloudflare Workers Runtime

- **Stateless**: No persistent connections or state between requests
- **Edge deployment**: Runs on Cloudflare's global network
- **V8 isolates**: Fast cold starts, efficient resource usage
- **HTTP-only**: No WebSockets or long-lived connections

### Transport

Uses the MCP **Streamable HTTP** transport specification with:
- JSON responses enabled
- No session management (stateless mode)
- CORS support for browser-based clients
- Token-based authentication

### Validation

All tool inputs are validated using Zod schemas before making API calls:
- Prevents invalid requests from reaching the Jules API
- Provides clear, actionable error messages
- Saves API quota by catching errors early
- Ensures type safety throughout the request pipeline

## Troubleshooting

### Deployment Issues

**Problem:** `wrangler deploy` fails

**Solutions:**
- Run `npx wrangler whoami` to verify authentication
- Check for TypeScript errors: `npm run build`
- Ensure `wrangler.toml` is valid

### Authentication Errors

**Problem:** 401 Unauthorized responses

**Solutions:**
- Verify `MCP_AUTH_TOKEN` is set: `npx wrangler secret list`
- Check that your client is sending the correct header
- Ensure the token matches exactly (no extra spaces)

### Missing API Key

**Problem:** "Missing JULES_API_KEY" error

**Solutions:**
- Set the secret: `npx wrangler secret put JULES_API_KEY`
- Verify it's set: `npx wrangler secret list`

### CORS Errors

**Problem:** Browser shows CORS errors

**Solutions:**
- The worker includes CORS headers by default
- Check that you're using HTTPS (not HTTP)
- Verify the request includes proper authentication

### Check Logs

Stream live logs to diagnose issues:

```bash
npm run tail
```

## Project Structure

```
jules-mcp-server/
├── src/
│   ├── worker.ts           # Cloudflare Workers entrypoint
│   ├── server.ts           # MCP server factory
│   ├── client/
│   │   └── jules-client.ts # Jules API client
│   ├── tools/
│   │   ├── index.ts        # Tool registry
│   │   ├── sources.ts      # Source management tools
│   │   ├── sessions.ts     # Session management tools
│   │   └── activities.ts   # Activity monitoring tools
│   ├── schemas/
│   │   └── index.ts        # Zod validation schemas
│   ├── resources/
│   │   └── index.ts        # MCP resources
│   └── types/
│       └── tool.ts         # Type definitions
├── wrangler.toml           # Cloudflare Workers config
├── DEPLOYMENT.md           # Detailed deployment guide
└── package.json
```

## Pricing

Cloudflare Workers free tier includes:
- 100,000 requests per day
- 10ms CPU time per request

For most MCP use cases, this is more than sufficient.

See [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/) for details.

## Additional Documentation

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Comprehensive deployment guide
- **[CHANGELOG.md](./CHANGELOG.md)** - Version history and changes

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- **Issues:** [GitHub Issues](https://github.com/yourusername/jules-mcp-server/issues)
- **Jules API:** [Jules API Docs](https://developers.google.com/jules/api)
- **MCP Specification:** [modelcontextprotocol.io](https://modelcontextprotocol.io)
- **Cloudflare Workers:** [developers.cloudflare.com/workers](https://developers.cloudflare.com/workers/)
