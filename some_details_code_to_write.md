# SuperAgentUI — Socket & State Management Deep Dive

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [The Central Store — `useSuperAgentSocketStore`](#2-the-central-store)
3. [Socket Connection & Attachment](#3-socket-connection--attachment)
4. [Sending a Message — Full Flow](#4-sending-a-message--full-flow)
5. [Receiving Events — Socket → Store → UI](#5-receiving-events--socket--store--ui)
6. [Session Management](#6-session-management)
7. [Thought Process (Run Events)](#7-thought-process-run-events)
8. [Hydration — Loading Past Conversations](#8-hydration--loading-past-conversations)
9. [Right Panel — Artifact State](#9-right-panel--artifact-state)
10. [Auto-Open Thought Panel](#10-auto-open-thought-panel)
11. [State Lifecycle Diagram](#11-state-lifecycle-diagram)
12. [File-by-File Responsibility Map](#12-file-by-file-responsibility-map)

---

## 1. Architecture Overview

The app follows a **unidirectional data flow** pattern built on three layers:

```
Socket (WebSocket / socket.io)
        ↓  emits events
useSuperAgentSocketStore (Zustand)
        ↓  reactive state
React Components (ChatArea, RightPanel, ThoughtPanel, etc.)
```

- **Socket** is the raw transport layer (socket.io), provided via a `SocketProvider` context.
- **Zustand store** (`useSuperAgentSocketStore`) is the single source of truth for all real-time state — messages, typing indicators, thought events, session IDs.
- **Components** subscribe to slices of the store and re-render only when their slice changes.

There is **no Redux**, **no Context** for chat state — Zustand handles everything reactively.

---

## 2. The Central Store

**File:** `socket/useSuperAgentSocketStore.js`

This is the heart of the system. It holds:

| State Key | Type | Purpose |
|---|---|---|
| `sessionId` | `string \| null` | Current conversation session |
| `messages` | `Message[]` | All chat messages (user + assistant) |
| `typing` | `boolean` | True while assistant is streaming tokens |
| `thinking` | `boolean` | True before first token arrives (processing phase) |
| `activeAssistantMessageId` | `string \| null` | ID of the currently-streaming assistant message |
| `currentRunId` | `string \| null` | The backend run ID of the active request |
| `thoughtsByRun` | `Record<runId, Event[]>` | Thought/execution events indexed by run ID |
| `thoughtsAutoOpenRunIds` | `Set<string>` | Run IDs that should auto-open the thoughts panel |

### Key Actions

#### `startAssistantMessage()`
Creates a new, empty assistant message in the `messages` array with `status: 'streaming'`, sets `thinking: true`, and saves its `id` as `activeAssistantMessageId`. This is called **optimistically** the moment the user sends a message — before any response arrives.

```js
// Inside the store
startAssistantMessage() {
  const id = uid();
  set((state) => ({
    messages: [...state.messages, {
      id, sender: 'assistant', content: '',
      status: 'streaming', run_id: null,
    }],
    thinking: true,
    activeAssistantMessageId: id,
  }));
}
```

#### `appendToAssistantMessage(messageId, chunk)`
Called on every `assistant_token` socket event. Finds the active message by ID and concatenates the incoming token to its `content`.

#### `finalizeAssistantMessage(messageId, run_id)`
Called on `assistant_end`. Marks the message `status: 'final'`, attaches the `run_id`, and resets `typing`, `activeAssistantMessageId`, and `currentRunId` to null.

#### `setCurrentRun(runId)`
Called on `assistant_process_start`. Updates `currentRunId` AND retroactively patches the active assistant message with this `run_id` (so that thought-process buttons work even during streaming).

#### `setThoughts(runId, newEvents)`
Merges incoming thought events into `thoughtsByRun[runId]`, deduplicating by `event.id`. Events are sorted by `sequence_index`.

---

## 3. Socket Connection & Attachment

**Files:** `SuperAgentWorkbench.jsx`, `socket/useSuperAgentSocketStore.js`

The socket itself is provided by an external `SocketProvider` context (outside this module). SuperAgentWorkbench retrieves it via `useSocket()` and **wires it to the store** in a single `useEffect`:

```js
// SuperAgentWorkbench.jsx
const { socket } = useSocket();
const attachSocket = useSuperAgentSocketStore((s) => s.attachSocket);

useEffect(() => {
  if (socket) attachSocket(socket);
}, [socket, attachSocket]);
```

`attachSocket` inside the store registers exactly **three socket listeners**:

```js
attachSocket(socket) {
  socket.on('assistant_process_start', (p) => handleSocketEvent('assistant_process_start', p, get));
  socket.on('assistant_token',         (p) => handleSocketEvent('assistant_token', p, get, set));
  socket.on('assistant_end',           (p) => handleSocketEvent('assistant_end', p, get));
}
```

All three delegate to `handleSocketEvent` in `superAgentSocketEvents.js`.

### Why `get` and `set` are passed in
The store's `attachSocket` passes `get` (current state getter) and `set` (state setter) into the event handler. This avoids stale closures — the handler always reads the latest state at the time the event fires.

---

## 4. Sending a Message — Full Flow

**File:** `ChatInput/ChatInput.jsx` → `socket/superAgentSocketUtils.js`

When the user clicks Send:

### Step 1 — File Upload (if attachments exist)
Files are uploaded via REST (`uploadDocuments`) before the socket message is sent. Each upload returns a `document_id`.

### Step 2 — `sendSuperAgentChat()` is called

```js
// superAgentSocketUtils.js
export function sendSuperAgentChat({ socket, sessionId, text, superAgentMode, attachments, mode }) {
  const store = useSuperAgentSocketStore.getState();
  const finalSessionId = sessionId || store.ensureSession();

  store.addUserMessage(text);        // 1. Optimistic user bubble
  store.startAssistantMessage();     // 2. Empty assistant bubble (thinking state)

  socket.emit('super_agent', {       // 3. Fire socket event
    mode: superAgentMode,
    message: text,
    session_id: finalSessionId,
    metadata: { attachments, mode },
  });
}
```

The UI updates **immediately** (steps 1 & 2) before any server response — this is the optimistic update pattern.

### Step 3 — Server responds via socket events (see section 5)

---

## 5. Receiving Events — Socket → Store → UI

**File:** `socket/superAgentSocketEvents.js`

All three inbound events are handled here:

### `assistant_process_start` → `{ run_id }`
The server has started processing. At this point no text has been generated yet.

```
store.setCurrentRun(run_id)
store.addThoughtsAutoOpenRunId(run_id)
```

Effect: The active assistant message bubble gets its `run_id` attached. The thought panel will auto-open (see section 10).

### `assistant_token` → `{ token }`
A chunk of the response text has arrived.

```
store.appendToAssistantMessage(activeAssistantMessageId, token)
set({ typing: true, thinking: false })
```

Effect: The assistant message bubble updates character by character. The spinner changes from "Thinking…" to "Typing…".

### `assistant_end` → `{ run_id }`
The response is complete.

```
store.finalizeAssistantMessage(activeAssistantMessageId, run_id)
store.removeThoughtsAutoOpenRunId(run_id)
```

Effect: Message is marked final. Typing indicators disappear.

---

### Separately — `event_updated` (Thought Events)

In `SuperAgentWorkbench.jsx`, a **fourth socket listener** is registered separately (not via `attachSocket`), specifically for thought process updates:

```js
socket.on('event_updated', async () => {
  const runId = useSuperAgentSocketStore.getState().currentRunId;
  const events = await fetchRunEvents(runId);  // REST call
  useSuperAgentSocketStore.getState().setThoughts(runId, events);
});
```

Every time the server emits `event_updated`, the app does a **REST fetch** for the latest events and merges them into the store. This is a polling-on-push pattern — the socket only signals "something changed", the actual data comes via HTTP.

---

## 6. Session Management

Sessions are the top-level containers for conversations. A session holds many **runs** (one run = one question → answer cycle).

### Session ID Sources (in priority order)
1. **URL param** (`?session=<id>`) — restored on page load
2. **Store's `ensureSession()`** — generates a new UUID if none exists

### `ensureSession()`
```js
ensureSession() {
  let { sessionId } = get();
  if (!sessionId) {
    sessionId = uid(); // crypto.randomUUID()
    set({ sessionId });
  }
  return sessionId;
}
```

This is called defensively in `sendSuperAgentChat` to guarantee a session always exists before emitting.

### Session Switch
When the user clicks a session in the sidebar:
```js
// Sidebar.jsx
onClick={() => {
  onSelectSession(id);   // → setSelectedSessionId in useSuperAgent hook
  setSession(id);        // → store.setSession (clears messages + state)
  onAgentChange(s?.agent_name);
}}
```

`store.setSession(id)` **wipes all in-memory chat state**:
```js
setSession(sessionId) {
  set({
    sessionId,
    messages: [],
    activeAssistantMessageId: null,
    currentRunId: null,
    thoughtsAutoOpenRunIds: new Set(),
  });
}
```

Then `useSuperAgent`'s `useEffect` on `selectedSessionId` fires `loadRuns(sessionId)`, which fetches the history via REST and calls `hydrateFromRuns()`.

### URL Sync
`SuperAgentWorkbench` keeps the URL in sync with state:
```js
useEffect(() => {
  if (!selectedSessionId || !activeAgent) return;
  setSearchParams({ session: selectedSessionId, agent: activeAgent });
}, [selectedSessionId, activeAgent]);
```

This means the URL is always shareable/bookmarkable.

---

## 7. Thought Process (Run Events)

Thought events represent the step-by-step execution tree of the AI agent's reasoning.

### Data Shape
Each event has:
- `id` — unique event ID
- `event_type` — `'main_step'` (phase marker) or other (leaf step)
- `parent_event_id` — enables tree structure
- `event_payload.content` — display text
- `sequence_index`, `local_index` — ordering

### Storage
Events are stored in `thoughtsByRun`:
```js
thoughtsByRun: {
  "run-abc-123": [ ...events ],
  "run-xyz-456": [ ...events ],
}
```

Indexed by run ID so the panel can display thoughts for any historical run, not just the current one.

### Fetching Strategy
There are **three fetch triggers**:

| Trigger | Where | When |
|---|---|---|
| `currentRunId` changes | `SuperAgentWorkbench` `useEffect` | Initial fetch when a new run starts |
| `event_updated` socket event | `SuperAgentWorkbench` `useEffect` | Incremental updates during processing |
| `activeArtifact` changes to `thoughts` | `SuperAgentWorkbench` `useEffect` | User manually opens a historical thought panel |

### Rendering
`ThoughtProcess.jsx` receives the flat event array and builds a recursive tree using `buildEventTree()` — a two-pass algorithm: first creates a `nodeMap`, then links children to parents, then sorts recursively by `sequence_index` + `local_index`.

---

## 8. Hydration — Loading Past Conversations

**Files:** `hooks/useSuperAgent.js`, `socket/useSuperAgentSocketStore.js`

When a session is selected, its history is loaded via:

```
fetchSessionRuns(sessionId)  →  REST API
        ↓
hydrateFromRuns(runs)        →  Zustand store
```

`hydrateFromRuns` transforms the API's run objects into the flat `messages` array format:

```js
runs.forEach((run) => {
  messages.push({
    id: `user-${run.run_id}`,
    sender: 'user',
    content: run.question?.query,
    files: run.question?.meta?.attachments,
    exports: [],
  });
  messages.push({
    id: `assistant-${run.run_id}`,
    sender: 'assistant',
    content: run.answer?.narrative.replace(/<end>$/, ''),
    exports: run.answer?.exports,
  });
});
```

Note the `<end>` suffix stripping — a backend artifact removed on the client side.

After hydration, the store also resets all streaming state (`typing: false`, `thinking: false`, etc.) since we're viewing completed history.

---

## 9. Right Panel — Artifact State

The right panel is driven entirely by a single piece of React state in `SuperAgentWorkbench`:

```js
const [activeArtifact, setActiveArtifact] = useState(null);
```

`activeArtifact` is an object describing **what to show**:

| Artifact Type | Shape | Panel Rendered |
|---|---|---|
| `chart` | `{ type: 'chart', s3_key }` | `ChartPanel` |
| `excel` | `{ type: 'excel', s3_key }` | `SheetPanel` |
| `html` | `{ type: 'html', s3_key }` | `HtmlPanel` |
| `pdf` | `{ type: 'pdf', artifacts: [...] }` | `TabbedPdfPanel` |
| `doc_group` | `{ type: 'doc_group', artifacts: [...] }` | `TabbedDocPanel` |
| `thoughts` | `{ type: 'thoughts', runId }` | `ThoughtPanel` |

`RightPanel` calls `resolvePanel(artifact)` which looks up `PANEL_REGISTRY` to get the right component. This is a clean **registry pattern** — adding a new panel type only requires adding one entry to `registry.js`.

`setActiveArtifact` is passed down as `onOpenPanel` to `ChatArea` → `Message`. Clicking any export button in a message bubble calls `onOpenPanel({ type, ... })` directly.

---

## 10. Auto-Open Thought Panel

This is a UX feature: when a new run starts, the thought panel **automatically opens** without user interaction.

### Mechanism

**Step 1** — On `assistant_process_start`, the run ID is added to a `Set`:
```js
store.addThoughtsAutoOpenRunId(run_id)
```

**Step 2** — A `useEffect` in `SuperAgentWorkbench` watches both `currentRunId` and `thoughtsAutoOpenRunIds`:
```js
useEffect(() => {
  if (!currentRunId) return;
  if (!thoughtsAutoOpenRunIds?.has(currentRunId)) return;

  setActiveArtifact({ type: 'thoughts', runId: currentRunId });
  removeThoughtsAutoOpenRunId(currentRunId);
}, [currentRunId, thoughtsAutoOpenRunIds]);
```

**Step 3** — On `assistant_end`, the run ID is removed from the set (cleanup):
```js
store.removeThoughtsAutoOpenRunId(run_id)
```

The `Set` is also cleared on session switch (`setSession`) to prevent stale auto-opens.

---

## 11. State Lifecycle Diagram

```
User types & clicks Send
        │
        ▼
ChatInput.handleSend()
  ├─ Upload files (REST, if any)
  └─ sendSuperAgentChat()
        │
        ├─ store.addUserMessage()         → messages[] gets user bubble
        ├─ store.startAssistantMessage()  → messages[] gets empty assistant bubble
        │                                    thinking=true
        └─ socket.emit('super_agent', …)
                │
                ▼
        [Server processes…]
                │
        socket ← 'assistant_process_start' { run_id }
                │
                ├─ store.setCurrentRun(run_id)
                └─ store.addThoughtsAutoOpenRunId(run_id)
                │
                ▼
        [Thought panel auto-opens via useEffect]
                │
        socket ← 'event_updated'  (repeats N times)
                │
                └─ fetchRunEvents(runId) [REST]
                   store.setThoughts(runId, events)
                │
        socket ← 'assistant_token' { token }  (repeats N times)
                │
                ├─ store.appendToAssistantMessage(id, token)
                └─ set({ typing:true, thinking:false })
                │
        socket ← 'assistant_end' { run_id }
                │
                ├─ store.finalizeAssistantMessage(id, run_id)
                │   → message status:'final', typing:false
                └─ store.removeThoughtsAutoOpenRunId(run_id)
                │
        socket ← 'assistant_end' (also in SuperAgentWorkbench)
                │
                ├─ reloadRuns()     → fetchSessionRuns → hydrateFromRuns
                └─ reloadSessions() → fetchSuperAgentSessions
```

---

## 12. File-by-File Responsibility Map

| File | Responsibility |
|---|---|
| `socket/useSuperAgentSocketStore.js` | Single source of truth. All chat state, socket attachment, all state mutations. |
| `socket/superAgentSocketEvents.js` | Pure event handler — maps socket event names to store method calls. No state, no side effects. |
| `socket/superAgentSocketUtils.js` | Outbound socket helper — `sendSuperAgentChat`. Handles optimistic updates before emitting. |
| `hooks/useSuperAgent.js` | REST-layer hook. Manages sessions list, loads runs, triggers hydration. |
| `SuperAgentWorkbench.jsx` | Orchestrator. Wires socket, URL, sessions, right panel, and all cross-cutting effects together. |
| `ChatArea/ChatArea.jsx` | Reads `messages`, `typing`, `thinking` from store. Renders message list and typing indicator. |
| `ChatInput/ChatInput.jsx` | User input, file uploads, mode selection. Calls `sendSuperAgentChat` on submit. |
| `Messages/Message.jsx` | Renders a single message bubble. Calls `onOpenPanel` to open right panel for exports/thoughts. |
| `RightPanel/RightPanel.jsx` | Renders the correct panel component based on `artifact.type` via registry. |
| `RightPanel/registry.js` | Maps artifact type strings to panel components. |
| `ThoughtProcess/ThoughtProcess.jsx` | Renders the execution event tree from a flat events array. |
| `api/super_agent_api.js` | All REST calls — sessions, runs, events, artifact preview/download URLs. |