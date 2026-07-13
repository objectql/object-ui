---
"@object-ui/plugin-chatbot": patch
"@object-ui/app-shell": patch
---

fix(console-ai): reliable ask→build handoff auto-send + second-handoff context re-carry (ADR-0057 P4)

Two follow-ups to the P4 "Open in Builder →" handoff:

- **Auto-send swallow.** The handoff's auto-sent first message could be dropped on
  a brand-new build conversation: the seed gated on the async-resolved
  `activeAgent`, which can settle *after* the conversation id is minted, so the
  deferred-send replay ran with an empty pending and never re-fired. The seed now
  gates on the **route** (`agentSegment`, synchronous) and bumps a `pendingSignal`
  that `useDeferredFirstSend` lists in its replay deps, so the seed always fires —
  no more empty build conversation on handoff.

- **Second-handoff re-carry.** A second "Open in Builder →" into the (singleton)
  build conversation now re-carries the latest ask context. The transport re-arms
  `parentConversationId` on each falsy→truthy transition of the prop (the ask
  thread is a singleton, so the same id repeats — the fresh-arrival signal is the
  transition the URL-mirror produces, not a changed value), and the seed re-arms
  on each new `handoffPrompt`.

Unit-tested: deferred-send replays a post-id seed via the signal; the transport
re-carries across a strip→re-supply cycle.
