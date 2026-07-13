---
"@object-ui/app-shell": patch
---

fix(console-ai): second handoff's auto-send no longer dies in the stale-scope pane (#2450)

Mid ask→build transition, `useChatConversation` briefly still holds the OLD
scope's conversation id (the same stale window the URL-mirror already guards).
`<ChatPane>` was fed that raw id, so a DOOMED pane (build chatApi + stale ask id,
about to remount) could mount — and the deferred first-send replay consumed the
handoff stash into it, where the send died with the unmount before reaching the
wire (observed live as "conversation resumes, zero `…/chat` POST").

Two-layer fix:

- **Scope-gated pane feed (structural):** the page now hands `<ChatPane>` a
  conversation id/messages ONLY when `conversationScope === chatScope`. During
  the stale window the pane mounts as `…:pending`, holds the stash, and replays
  exactly once in the correctly-scoped pane — extending the existing URL-mirror
  guard to the pane itself.
- **Targeted stash (defense-in-depth):** the handoff seed is stamped
  `targetAgentRoute: 'build'`; `useDeferredFirstSend` refuses to consume a
  targeted stash in a pane bound to another agent (untargeted user-typed sends
  keep the legacy consume-anywhere behavior).

Per product decision, a second handoff landing on a conversation with a
blueprint still Awaiting Approval just auto-sends — the build agent sees the
pending plan in context and decides merge/supersede itself.
