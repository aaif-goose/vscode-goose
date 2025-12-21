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
- **Message-driven** webview communication (24 typed message types)
- **Version-gated activation** (requires goose >= 1.16.0)
- **fp-ts** for typed async error handling
