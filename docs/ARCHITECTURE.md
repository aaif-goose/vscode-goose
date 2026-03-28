# Architecture

For detailed architecture documentation, see the knowledge base:

- **[Overview & Quick Reference](../.rp1/context/index.md)** - Project summary, structure, key features
- **[System Architecture](../.rp1/context/architecture.md)** - Component diagrams, data flows, integration points
- **[Module Breakdown](../.rp1/context/modules.md)** - Detailed component responsibilities
- **[Implementation Patterns](../.rp1/context/patterns.md)** - Code conventions, error handling, UI patterns
- **[Domain Concepts](../.rp1/context/concept_map.md)** - Terminology and business concepts

## Quick Summary

The extension is a **thin UI bridge** connecting VS Code to Goose via the **Agent Communication Protocol (ACP)**:

```
VS Code Webview (React) ←→ Extension Host ←→ goose subprocess (JSON-RPC 2.0 over stdin/stdout)
```

Key architectural decisions:
- **No business logic** in the extension - pure orchestration
- **Message-driven** webview communication with 30+ typed message variants
- **Version-gated activation** (requires goose >= 1.16.0)
- **fp-ts** for typed async error handling
- **Structured assistant streaming** for text, thinking, and tool-call activity
- **ACP-backed session settings** for mode and model selection in the composer

## Recent Architecture Notes

Recent work in this repo added a few important behaviors that are easy to miss if you only remember the original chat bridge:

- **Structured assistant content**: the webview no longer treats every assistant reply as plain markdown. `useChat` now builds `contentParts` that can include text chunks, thinking chunks, and tool-call cards.
- **Tool call visibility**: ACP `session/update` notifications for `tool_call` and `tool_call_update` are translated into dedicated UI cards, including input, output, preview text, and source locations when available.
- **Session settings synchronization**: mode and model choices are surfaced from ACP session metadata and can be changed live from the chat composer.
- **History pane layout**: session history now opens in a right-side pane with animated transitions, resize support, and an overlay fallback when the editor column is narrow.
- **Long-running prompts**: `session/prompt` requests are issued without a client timeout so long responses do not get marked as cancelled locally.
