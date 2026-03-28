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
| `session/set_mode` | Change the active session mode when the agent exposes modes |
| `session/set_model` | Change the active session model when the agent exposes model switching |
| `session/set_config_option` | Change model-like config when the agent exposes it as a config option instead of a direct model selector |

### Notifications Handled

| Notification | Purpose |
|--------------|---------|
| `session/update` | Streaming response chunks, thinking chunks, tool-call updates, history replay updates, and session setting updates |

### Notifications Sent

| Notification | Purpose |
|--------------|---------|
| `session/cancel` | Cancel the active generation |

### Content Blocks

When sending `session/prompt`, the extension builds mixed prompt blocks:

```typescript
{ type: "resource_link", uri: string, mimeType: string }
{ type: "text", text: string }
```

- Whole-file context chips are sent as `resource_link` blocks so Goose can read the file.
- Line-range selections are read by the extension and sent inline as `text` blocks.
- User-authored prompt text is appended as a final `text` block.

### Request Behavior

- JSON-RPC transport uses newline-delimited JSON over stdio.
- `session/prompt` is intentionally sent with no client-side timeout to support long-running generations without false local cancellation.

## Implementation Files

- `src/extension/jsonRpcClient.ts` - JSON-RPC client with ndjson framing
- `src/extension/subprocessManager.ts` - Process lifecycle management
- `src/extension/versionChecker.ts` - Version validation (>= 1.16.0)
- `src/shared/errors.ts` - Typed error handling
