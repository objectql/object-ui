---
'@object-ui/plugin-chatbot': minor
---

feat(ai-build): event-driven "Designing your app…" progress for the blueprint-design stream (Refs cloud#657, cloud#655)

`propose_blueprint` now streams a reconciled `data-blueprint-progress` part while it drafts the plan (a tens-of-seconds, otherwise-opaque LLM call), so the chat shows the app taking shape — objects appearing one-by-one with their field counts, the summary / extend target revealed progressively, and a `seq`-driven liveness cue — instead of a purely presentational rotating-hint placeholder.

- `mapMessages`: `uiMessageToChatMessage` lifts the latest `data-blueprint-progress` frame onto `ChatMessage.blueprintProgress` (same single-reconciled-part mechanism as `data-build-progress`; transient, never persisted). This is the shared streaming converter both the full-page AI Build surface (`AiChatPage` via `useObjectChat`) and the floating console chatbot already route through.
- `ChatbotEnhanced`: a new `BlueprintProgressPanel` renders the live "Designing…" card (object chips + summary + running counts + liveness). It supersedes the rotating-hint placeholder while events flow, and yields to the authoritative "Proposed plan" card the instant the `propose_blueprint` result lands.
- Graceful degradation: with no `data-blueprint-progress` events (older runtimes / non-streaming turns) the existing rotating-hint placeholder behaves exactly as before — zero regression. On reload the persisted "Proposed plan" card is the record (the live panel is transient by design).
