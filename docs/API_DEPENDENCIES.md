# ACP Protocol Reference

This extension communicates with goose via the **[Agent Communication Protocol (ACP)](https://agentclientprotocol.com/overview/introduction)** using JSON-RPC 2.0 over stdin/stdout.

## Protocol

- **Transport**: stdin/stdout with ndjson framing
- **Spec**: [agentclientprotocol.com](https://agentclientprotocol.com)
- **Version Requirement**: goose >= 1.16.0

## Extension-Specific Implementation

### Methods Used

| Method | Purpose |
|--------|---------|
| `initialize` | Initialize ACP connection |
| `session/new` | Create new chat session |
| `session/load` | Load session with history |
| `session/prompt` | Send user message |

### Notifications Handled

| Notification | Purpose |
|--------------|---------|
| `session/update` | Streaming response chunks |
| `session/cancel` | Cancel generation |

### Content Blocks

When sending `session/prompt`, context chips are sent as `resource_link` blocks:

```typescript
{ type: "resource_link", uri: string, range?: LineRange }
```

## Implementation Files

- `src/extension/jsonRpcClient.ts` - JSON-RPC client with ndjson framing
- `src/extension/subprocessManager.ts` - Process lifecycle management
- `src/extension/versionChecker.ts` - Version validation (>= 1.16.0)
- `src/shared/errors.ts` - Typed error handling
