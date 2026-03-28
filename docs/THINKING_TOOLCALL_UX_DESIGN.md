# Thinking And Tool Call UX Design

## Goal

Add first-class UX in `vscode-goose` for:

- assistant thinking / reasoning
- tool call lifecycle
- action-required / permission prompts

without turning the extension into a separate product from Goose desktop.

This design should let us incrementally improve the VS Code webview while keeping the extension a thin ACP-to-UI bridge.

## Current State

Today the extension only renders a narrow subset of Goose activity:

- user sends a prompt
- webview creates a blank assistant message
- extension forwards `agent_message_chunk` text as `STREAM_TOKEN`
- webview appends streamed text into one assistant `content: string`
- assistant message completes when `session/prompt` returns

What is missing today:

- `agent_thought_chunk` / thinking content
- `tool_call` start events
- `tool_call_update` status updates
- action-required / permission requests
- structured history for the above

## External Reality

The Goose ACP side already exposes richer structure than `vscode-goose` currently consumes.

Relevant ACP updates handled in `block-goose`:

- `SessionUpdate::AgentMessageChunk`
- `SessionUpdate::AgentThoughtChunk`
- `SessionUpdate::ToolCall`
- `SessionUpdate::ToolCallUpdate`
- `SessionUpdate::CurrentModeUpdate`
- `SessionUpdate::ConfigOptionUpdate`

Relevant files:

- `block-goose/crates/goose/src/acp/provider.rs`
- `block-goose/crates/goose/src/conversation/message.rs`
- `block-goose/ui/desktop/src/types/message.ts`
- `block-goose/ui/desktop/src/components/ProgressiveMessageList.tsx`

Goose desktop uses a rich message-content model rather than flattening everything into one text string. The VS Code design should follow the same direction.

## Design Principles

1. Preserve structure, do not flatten early.
2. Stay conceptually aligned with Goose desktop.
3. Keep ACP-specific details out of rendering components.
4. Treat assistant output as an ordered sequence of typed content blocks.
5. Keep the extension host thin: normalize ACP events, then forward them.
6. Make the live-streaming design work first; history can be phased in later.
7. Prefer compact default rendering with progressive disclosure for details.

## Recommended Architecture

### Summary

Adopt a desktop-like rich assistant message model in `vscode-goose`.

Instead of:

- `ChatMessage.content: string`

for assistant output, we should support:

- `ChatMessage.contentParts: ChatContentPart[]`

where each part is a typed block such as text, thinking, tool request, tool response, or action-required content.

This is intentionally close to Goose desktop's `MessageContent[]` model. We should reuse that mental model even if the exact TypeScript names differ slightly.

## Proposed Data Model

### Keep Existing High-Level Message Shape

We can keep a single transcript list containing user, assistant, and error messages:

```ts
interface ChatMessage {
  id: string;
  role: MessageRole;
  timestamp?: Date;
  status: MessageStatus;
  context?: readonly MessageContext[];
  content?: string;
  contentParts?: readonly ChatContentPart[];
}
```

Rules:

- `user` messages may continue using `content: string`
- `error` messages may continue using `content: string`
- `assistant` messages should move to `contentParts`
- `content` on assistant messages can be kept temporarily as a derived / compatibility field during migration, then removed later

### New Content Part Union

```ts
type ChatContentPart =
  | TextPart
  | ThinkingPart
  | ToolRequestPart
  | ToolResponsePart
  | ActionRequiredPart
  | SystemNotificationPart;

interface TextPart {
  type: 'text';
  text: string;
  streaming?: boolean;
}

interface ThinkingPart {
  type: 'thinking';
  text: string;
  streaming: boolean;
  signature?: string;
}

interface ToolRequestPart {
  type: 'tool_request';
  id: string;
  title?: string;
  toolName: string;
  kind?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  rawInput?: unknown;
  locations?: readonly ToolLocation[];
}

interface ToolResponsePart {
  type: 'tool_response';
  id: string;
  status: 'completed' | 'failed';
  rawOutput?: unknown;
  contentPreview?: readonly string[];
}

interface ActionRequiredPart {
  type: 'action_required';
  id: string;
  actionType: 'tool_confirmation' | 'elicitation';
  title?: string;
  toolName?: string;
  arguments?: Record<string, unknown>;
  prompt?: string;
  requestedSchema?: unknown;
  resolved?: boolean;
}

interface SystemNotificationPart {
  type: 'system_notification';
  notificationType: 'thinking_message' | 'inline_message';
  message: string;
  data?: unknown;
}

interface ToolLocation {
  path: string;
  line?: number;
}
```

### Why This Model

This gives us:

- ordered rendering within one assistant turn
- stable tool IDs for updates
- explicit support for thinking and action-required states
- room to grow toward desktop parity

This is intentionally similar to Goose desktop's content model, but slightly simplified for the current VS Code needs.

## Transport Between Extension And Webview

### Problem With Current Transport

Current webview transport only models:

- `STREAM_TOKEN`
- `GENERATION_COMPLETE`
- `GENERATION_CANCELLED`

That is too narrow for rich activity.

### Recommended Transport

Introduce normalized extension-to-webview event types for assistant turn assembly.

Example new message types:

```ts
TURN_STARTED
TURN_TEXT_DELTA
TURN_THINKING_DELTA
TURN_TOOL_CALL_STARTED
TURN_TOOL_CALL_UPDATED
TURN_TOOL_CALL_COMPLETED
TURN_ACTION_REQUIRED
TURN_SYSTEM_NOTIFICATION
TURN_COMPLETED
TURN_CANCELLED
```

Notes:

- These should be normalized UI events, not raw ACP payloads.
- The webview should not need to know ACP schema specifics.
- Existing `STREAM_TOKEN` can be kept briefly during migration, then removed.

### Why Normalize In The Extension

The extension should:

- observe ACP `session/update`
- translate ACP updates into a small UI-specific event vocabulary
- send those normalized events to the webview

This keeps:

- ACP coupling in one place
- webview reducer simpler
- future provider changes easier to absorb

## Extension Host Changes

### `src/extension/extension.ts`

Replace the current narrow `session/update` handling with richer mapping logic.

Current behavior:

- forwards only `agent_message_chunk` text

Desired behavior:

- `agent_message_chunk` -> `TURN_TEXT_DELTA`
- `agent_thought_chunk` or ACP thought update -> `TURN_THINKING_DELTA`
- `tool_call` -> `TURN_TOOL_CALL_STARTED`
- `tool_call_update(status)` -> `TURN_TOOL_CALL_UPDATED` or `TURN_TOOL_CALL_COMPLETED`
- permission request path -> `TURN_ACTION_REQUIRED`

### Correlation

For each user send, the extension already has a `responseId`. That should remain the primary turn identifier in the webview.

Rules:

- all assistant activity for one user submission maps to one assistant turn ID
- tool updates are nested under that turn via their own tool `id`
- completion and cancellation terminate the turn

### Avoid Leaking Raw ACP Objects

Do not send entire ACP `ToolCallUpdate` or `RequestPermissionRequest` objects to the webview if they contain more structure than the UI needs.

Instead extract the display fields needed for:

- title
- tool name
- status
- arguments
- prompt
- content preview
- path / location metadata

## Shared Types Changes

### `src/shared/types.ts`

Add:

- `ChatContentPart`
- concrete part interfaces
- optional helper predicates:
  - `isAssistantMessage`
  - `isTextPart`
  - `isThinkingPart`
  - `isToolRequestPart`
  - `isToolResponsePart`
  - `isActionRequiredPart`

### `src/shared/messages.ts`

Add new webview message types and payloads for turn/activity events.

Also add factory and type-guard helpers for each new message type.

Keep naming consistent and explicit. Avoid generic names like `ACTIVITY_UPDATE` unless payloads are strongly discriminated.

## Webview State Management

### `src/webview/hooks/useChat.ts`

The reducer should move from "one assistant string" assembly to "one assistant message with typed content parts".

Recommended new reducer actions:

```ts
START_ASSISTANT_TURN
APPEND_TEXT_DELTA
APPEND_THINKING_DELTA
START_TOOL_CALL
UPDATE_TOOL_CALL
COMPLETE_TOOL_CALL
ADD_ACTION_REQUIRED
ADD_SYSTEM_NOTIFICATION
COMPLETE_ASSISTANT_TURN
CANCEL_ASSISTANT_TURN
```

### Reducer Rules

#### Start Assistant Turn

When a user sends a message:

- add the user message as today
- add an empty assistant message with:
  - `role: assistant`
  - `status: streaming`
  - `contentParts: []`

#### Text Deltas

Append text into the last text part when possible.

If the last part is not `text`, create a new text part.

#### Thinking Deltas

Append into the last `thinking` part if it is streaming.

If not present, create a new `thinking` part with `streaming: true`.

When the turn completes:

- mark the last streaming thinking block as no longer streaming

#### Tool Start

Add a `tool_request` part if one with that tool ID does not already exist.

If it already exists, update it in place.

#### Tool Update / Completion

Find the part by tool ID and update:

- status
- raw output
- locations
- preview content

If the data model needs separate request/response blocks, add a `tool_response` part on completion instead of mutating only the request.

Preferred initial approach:

- create `tool_request` on start
- optionally add `tool_response` on completion if result data exists

This mirrors desktop more closely.

#### Action Required

Add an `action_required` part to the current assistant message.

Open question:

- should this pause send UI / show inline actions immediately in phase 1?

Recommendation:

- render it read-only first unless full approval flow is explicitly in scope

## Webview Rendering

### New Components

Add dedicated components under `src/webview/components/chat/`:

- `AssistantTurn.tsx`
- `ThinkingBlock.tsx`
- `ToolCallCard.tsx`
- `ToolResponseBlock.tsx`
- `ActionRequiredCard.tsx`
- `SystemNotificationInline.tsx`

### `AssistantTurn.tsx`

Responsibilities:

- iterate over `contentParts`
- route each part to the appropriate presentational component
- render timestamp / cancelled status / copy affordance

This should replace the current assumption in `AssistantMessage.tsx` that assistant content is one markdown body.

### `ThinkingBlock.tsx`

Behavior:

- subtle visual treatment
- while streaming: show "Thinking…" state
- once complete: collapsible, collapsed by default
- keep text selectable

Design direction:

- closer to Goose desktop than ChatGPT-style hidden chain-of-thought chrome
- compact and subdued

### `ToolCallCard.tsx`

Behavior:

- compact summary by default
- tool icon or category
- status indicator
- expandable arguments / output
- file locations if present

Design direction:

- similar to Goose desktop compact tool cards
- avoid oversized panels in the narrow VS Code side pane

### `ToolResponseBlock.tsx`

Behavior:

- render concise output preview
- support code-style output if the result is textual
- collapse long output by default

### `ActionRequiredCard.tsx`

Phase 1:

- render the request clearly
- no buttons if approval flow is not yet wired

Phase 2:

- add action buttons if we implement permission response from the webview

### `SystemNotificationInline.tsx`

Use for:

- compacting notifications
- inline informational system messages

## Migration Strategy

### Phase 1: Live Thinking + Tool Activity

Implement:

- new shared event types
- extension mapping for thought and tool lifecycle
- new reducer support
- assistant message rendering from `contentParts`
- read-only thinking and tool cards

Do not implement yet:

- history replay for rich content
- inline approval actions

### Phase 2: Action-Required Rendering

Implement:

- action-required part model
- read-only action-required rendering
- optional button handling if desired

### Phase 3: History Parity

Investigate whether ACP session history and local session replay can preserve:

- thinking
- tool request / response blocks
- action-required items

If yes:

- extend session history loading to hydrate `contentParts`

If no:

- leave history flattened and document that rich activity is live-only

## Compatibility Plan

To reduce migration risk:

1. add `contentParts` without removing `content`
2. switch assistant rendering to prefer `contentParts`
3. continue deriving plain text from text parts where needed
4. remove old assistant-string assumptions after the UI is stable

This lets user and error messages remain unchanged while assistant messages migrate first.

## Testing Plan

### Unit Tests

Add reducer tests for:

- assistant turn starts empty
- text deltas coalesce into one text part
- thinking deltas coalesce into one thinking part
- tool start creates request part
- tool completion updates request or adds response part
- completion marks streaming parts complete
- cancellation preserves partial content and marks cancelled

### Extension Tests

Add notification mapping tests for:

- ACP text chunk -> webview text event
- ACP thought chunk -> webview thinking event
- ACP tool call -> tool-start event
- ACP tool status update -> tool-update event

### Rendering Tests

Add component tests for:

- thinking block collapsed and expanded states
- tool card status rendering
- assistant message with mixed parts

## Open Questions

1. Should thinking content be shown by default or collapsed by default once complete?

Recommendation:

- visible while streaming
- collapsed by default after completion

2. Should tool completion mutate the request card or produce a separate response block?

Recommendation:

- desktop-aligned answer: separate request and response parts when result data is meaningful
- pragmatic first pass: one request card updated with completion state, plus optional preview

3. Should action-required be interactive in phase 1?

Recommendation:

- no, render read-only first

4. Should history preserve rich activity immediately?

Recommendation:

- no, phase it after live streaming works

## Recommended File-Level Implementation Order

1. `src/shared/types.ts`
2. `src/shared/messages.ts`
3. `src/extension/extension.ts`
4. `src/webview/hooks/useChat.ts`
5. `src/webview/components/chat/AssistantMessage.tsx`
6. new chat activity components
7. tests

## Non-Goals

This design does not aim to:

- reproduce Goose desktop 1:1
- expose raw chain-of-thought beyond what Goose already surfaces as thinking content
- add large new dependencies
- turn the extension into a workflow orchestrator beyond ACP UI bridging

## Decision

We should implement rich assistant activity in `vscode-goose` using a Goose-desktop-like typed content model.

The key decision is:

- assistant output becomes structured content parts
- ACP updates are normalized in the extension
- the webview reducer assembles assistant messages from those parts
- dedicated components render thinking, tool calls, and action-required states

This is the most correct architecture because it matches the real structure of Goose events and avoids flattening rich activity into plain text.
