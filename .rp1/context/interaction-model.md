---
scope: kbRoot
path_pattern: "interaction-model.md"
producer: knowledge-base
type: document
description: "Cross-surface interaction semantics, UX principles, user-visible states, and accessibility constraints for a single-project codebase."
strictness: strict
---
# vscode-goose — Interaction Model

**Project**: vscode-goose
**Analysis Date**: 2026-04-23
**Surfaces**: VS Code webview (chat), editor context menu + keybinding, command palette, output channel, settings, notifications

## Experience Principles

- **Thin UI bridge, no bloat** — The extension is deliberately a thin bridge between VS Code and the Goose ACP agent; every surface stays minimal and defers agent semantics to Goose. Evidence: `AGENTS.md`, `webviewProvider.ts` (single chat view), `commands.ts` (only 3 commands).
- **Native VS Code aesthetic via CSS variables** — Colors, fonts, focus rings, badges, hover backgrounds, and list selections are bound to VS Code theme tokens so the webview inherits the user's theme automatically. Evidence: `src/webview/theme.ts`, `src/webview/styles.css`, pervasive `var(--vscode-*)` usage.
- **Ready-gate + replay for extension → webview messages** — The extension never assumes the webview is mounted. Messages are queued until a `WEBVIEW_READY` signal, then flushed; last process/version status is re-sent on reconnect. Evidence: `webviewProvider.ts` (`messageQueue`, `flushQueue`, `resendState`, `waitForReady`), `bridge.ts` (`createWebviewReadyMessage`).
- **Stream-first, cancelable generation** — Assistant responses stream token-by-token with a live cursor and a Stop control that is always one key or click away. Cancel is first-class. Evidence: `useChat.ts` (`STREAM_TOKEN`/`COMPLETE_GENERATION`/`CANCEL_GENERATION`), `MarkdownRenderer.tsx` (cursor when streaming), `AssistantMessage.tsx` (`(cancelled)`), `StopButton.tsx`, `useKeyboardNav.ts` (Escape while generating).
- **Keyboard-first input with chip integration** — `Enter` sends, `Shift+Enter` adds a newline, `@` opens file picker, `Backspace`/`ArrowLeft` at cursor-0 jumps into the chip stack, `Cmd/Ctrl+Up/Down` navigates message history, `Escape` stops generation. Evidence: `InputArea.tsx`, `useFilePicker.ts`, `useKeyboardNav.ts`.
- **Glanceable session identity** — The top bar always shows the active session title (or `New Session`) plus two affordances (New Chat, History). Session list groups by date and shows cwd. Evidence: `SessionHeader.tsx`, `SessionList.tsx`, `SessionCard.tsx`.
- **Version gating before anything else** — If Goose is missing or outdated, the chat UI is replaced wholesale by a blocking guidance view with a single CTA (Install / Update). Evidence: `App.tsx` `isVersionBlocked` short-circuit, `VersionBlockedView.tsx`, `webviewProvider.updateVersionStatus`.

## Actors & Surfaces

| Actor | Surface | Goal | Entry Points |
|-------|---------|------|--------------|
| VS Code developer | Activity-bar chat webview | chat with Goose, attach context, resume sessions | activity bar `Goose`, sidebar toggle, `goose.chatView.focus` |
| VS Code developer | Editor context menu + keybinding | send selection to chat | right-click → "Send to Goose", `Cmd/Ctrl+Shift+G` |
| VS Code developer | Command palette | discoverable operator actions | `Goose: Show Logs`, `Goose: Restart`, `Send to Goose` |
| Extension operator | Output channel "Goose" | diagnose activation / subprocess / bus | `Goose: Show Logs` |
| Extension operator | Settings (`goose.*`) | configure binary path, log level | VS Code Settings UI / `settings.json` |
| VS Code developer | Notifications | read status of restart / missing binary | triggered by `goose.restart` |

## Primary Actions

### Goose chat webview (activity bar)
**Role**: Primary conversation surface; hosts the React app with session header, history panel, message list, chips, input, and file picker.
**Primary actions**: type + send a message · stop generation · open `@` file picker · remove / navigate context chips · retry a failed message · copy assistant output · expand truncated history messages · open/close session history panel · start new session · select existing session.
**Intentional constraints**: no tool-approval UI, no model switcher, no agent config — agent lives in goose; chat UI stays minimal.
**Evidence**: `package.json` views.goose, `App.tsx`, `ChatView.tsx`, `SessionHeader.tsx`, `SessionList.tsx`.

### Editor context menu + keybinding
**Role**: Context-ingestion surface that ships the current selection (or whole file) into the active chat as a context chip.
**Primary actions**: add selection/file as context chip · auto-focus the chat input.
**Evidence**: `package.json` `menus.editor/context` + `keybindings`, `commands.ts` `registerTextEditorCommand('goose.sendSelectionToChat')` posts `ADD_CONTEXT_CHIP` + `FOCUS_CHAT_INPUT`.

### Command palette
**Role**: Discoverable surface for operator-level actions.
**Primary actions**: reveal output channel · restart subprocess · send selection to chat.
**Evidence**: `package.json` `contributes.commands`.

### Output channel ("Goose")
**Role**: Read-only log surface for troubleshooting binary discovery, subprocess, and message-bus events.
**Primary actions**: read logs.
**Evidence**: `commands.ts` (`outputChannel.show`).

### Settings (Goose section)
**Role**: Configuration for binary path and log level.
**Primary actions**: set `goose.binaryPath` · set `goose.logLevel`.
**Evidence**: `package.json` `contributes.configuration`.

### VS Code notifications
**Role**: Transient feedback for operator actions outside the chat panel.
**Primary actions**: read message · dismiss.
**Evidence**: `commands.ts` (`showInformationMessage` / `showWarningMessage` / `showErrorMessage` in `goose.restart`).

## User-Visible States

| State | Meaning | Surface Signals |
|-------|---------|-----------------|
| `STOPPED` / `STARTING` / `RUNNING` / `ERROR` | subprocess lifecycle | "Waiting for Goose…" (stopped), "Connecting to Goose…" (starting), "Connection error" + "Please check the Goose binary path in settings" (error), chat UI mounts only on `RUNNING` |
| `blocked_missing` / `blocked_outdated` | version gate failure | full-screen "Welcome to Goose" (install CTA) / "Goose Update Required" with detected vs minimum version |
| Message generating (`STREAMING`) | assistant is producing tokens | SendButton → StopButton; blinking cursor appended to streamed markdown; `ProgressIndicator` (three bouncing dots + "Goose is thinking…" SR text) while content is empty; `aria-busy=true` on chat container |
| Message `CANCELLED` | user stopped generation mid-stream | `(cancelled)` label next to assistant timestamp |
| Message `ERROR` | send/generation failed | red-bordered error bubble with error icon; inline "Retry" when `originalContent` retained; `role="alert"` |
| Empty chat (new/empty session) | no messages yet | `GooseWatermark` centered in the message area; `New Session` header |
| Session history loading / unavailable | hydrating a session, or history could not be loaded | "Loading session history…" strip; "Session history is not available. Continue from where you left off." warning strip |
| History message | replayed from persisted history | italic "Earlier" timestamp; "Show more (N lines)" / "Show less" toggle; no streaming cursor |
| File picker open | `@` triggered at word boundary | dropdown above input with filename/relative path; highlighted selected row; "No results found" for empty queries |
| Copy feedback | clipboard attempt outcome | icon+label swaps to "Copied!" (green) or "Failed" (red) for ~2 s |

## Feedback Loops

- **Send → stream → complete** — User bubble appears immediately; SendButton swaps to StopButton; ProgressIndicator until first token; tokens stream into assistant bubble with blinking cursor; final state hides cursor and enables Copy on hover. Evidence: `useChat.ts` (`ADD_USER_MESSAGE → START_GENERATION → STREAM_TOKEN → COMPLETE_GENERATION`), `InputArea.tsx`, `AssistantMessage.tsx` group-hover copy.
- **Stop mid-generation** — StopButton or Escape while generating → `STOP_GENERATION` → assistant marked `(cancelled)` → input returns to Send. Evidence: `StopButton.tsx`, `useKeyboardNav.ts`, `useChat.ts` `CANCEL_GENERATION`.
- **Error → Retry** — Generation fails with `originalContent` preserved → red error bubble with Retry link → retry re-sends as a fresh user message with a new response id. Evidence: `ErrorMessage.tsx`, `useChat.ts` `retryMessage`.
- **Editor selection → context chip** — `Send to Goose` focuses view, auto-creates session if missing, waits for ready, chip appears with `filename[:start-end]`, input focused, SR announces "Added context: <name>". Evidence: `commands.ts`, `webviewProvider.waitForReady`, `useContextChips.ts` `ADD_CHIP`, `InputArea.tsx` `FOCUS_CHAT_INPUT`.
- **@ file picker** — `@` trigger → debounced (~100 ms) search → dropdown opens → keyboard nav → Enter/Tab inserts chip and removes `@query` → Escape/outside click closes. Evidence: `useFilePicker.ts` (`detectAtTrigger`, `DEBOUNCE_MS=100`, `selectResult`), `fileSearchService.ts`.
- **Session switch** — Click History → pick a card → loading strip → `HISTORY`/`HISTORY_COMPLETE` replay → panel closes → header title updates → history-unavailable banner if applicable. Evidence: `SessionList.tsx`, `useSession.ts`, `App.tsx` banners.
- **Restart subprocess** — `Goose: Restart` → warning if manager absent, error if binary not found or start fails, info "Goose restarted successfully" on success. Webview reconnects via ready signal; state is re-sent. Evidence: `commands.ts`, `webviewProvider.resendState`.
- **Auto-scroll during streaming** — New tokens arrive while near bottom → pin; if user scrolls up mid-stream, auto-scroll yields until they return. Evidence: `useAutoScroll.ts` (`userScrolledUp` ref, threshold 100).

## Accessibility & Discoverability

- **Semantic landmarks**: `ChatView.tsx` uses `aria-label="Chat with Goose"`, `aria-busy`; `MessageList.tsx` `role="log"` + `aria-live="polite"`; `MessageItem.tsx` `role="article"` / `role="alert"` for errors.
- **Live-region announcements for chips**: `useContextChips.ts` announcement strings; `ChipStack.tsx` `role="status"` `aria-live="polite"` sr-only region.
- **Keyboard navigation for chips**: `ChipStack.tsx` ArrowLeft/Right, Delete/Backspace, Tab/Escape; `ContextChip.tsx` `role="button"` `tabIndex=0`, descriptive aria-label.
- **Keyboard navigation across messages**: `useKeyboardNav.ts` Cmd/Ctrl+ArrowUp/Down with Mac detection; `MessageList.scrollToMessage`.
- **Escape stops generation**: `useKeyboardNav.ts` Escape branch → `StopButton` action.
- **Reduced motion**: `styles.css` `@media (prefers-reduced-motion: reduce)` typing-pulse keyframes.
- **Theme tokens only**: `theme.ts` + `styles.css` `@theme`; `var(--vscode-focusBorder)` for focus rings.
- **Strict webview CSP with nonce**: `webviewProvider.ts getWebviewContent` sets `default-src 'none'; script-src 'nonce-…'`; `localResourceRoots` restricted to `dist/webview`.
- **External links routed via host**: `MarkdownRenderer.tsx` posts `OPEN_EXTERNAL_LINK`; `VersionBlockedView.tsx` uses same flow for install/update CTAs.
- **Labeled icon-only buttons**: `SessionHeader`, `SessionList`, `SendButton`, `StopButton`, `CopyButton` — all carry `aria-label` + `title`.

## Cross-Surface Deltas

| Behavior | Surfaces | Delta | Reason |
|----------|----------|-------|--------|
| Context ingestion | Editor menu/shortcut vs webview `@` picker | Editor path attaches selection with line range; `@` picker attaches whole-file (no range) and suppresses duplicates | Selections carry intentional range; `@` browsing is file-scoped and refined later conversationally |
| Active-session requirement | Editor command vs webview Send | Editor-to-chat path auto-creates a session if none exists; webview Send assumes a session already exists (status must be `RUNNING`) | `Send to Goose` from editor must never fail; in-webview users already have visible session context |
| Message timestamps | Live vs replayed history | Live: localized `HH:MM`; history: italic "Earlier" placeholder, truncated to 15 lines by default | History messages often lack precise timestamps and can be long; collapsing keeps replay glanceable |
| Version enforcement | Webview chat vs command palette | Full-screen blocking view in webview; operator commands (`Goose: Restart`, `Goose: Show Logs`) remain available | Operators must retain remediation paths when chat is blocked |

## Related KB Links

- **System topology**: See [architecture.md](architecture.md)
- **Component inventory**: See [modules.md](modules.md)
- **Terminology**: See [concept_map.md](concept_map.md)
- **Implementation details**: See [patterns.md](patterns.md)
