---
"@object-ui/app-shell": patch
---

feat(console-ai): key AI chat conversations on `(user, app, product)`, not on surface (ADR-0057 P1)

The console rendered AI chat through parallel shells that **forked the
conversation**: the Studio design copilot scoped its thread as
`studio:${packageId}:${agent}` while the full-page `/ai/build` focus view scoped
on the agent alone — so opening the *same app* in both showed an empty "Build
with AI" copilot beside an active full-page build thread (indistinguishable from
data loss).

Per ADR-0057 (**surface = view · conversation = model · product = binding
axis**), conversations are now keyed on `(user, app, product)`:

- New pure, unit-tested `chatConversationScope({ appId, product })` +
  `chatProductOfAgent(name)` helper (`hooks/chatScope.ts`) is the single place
  the scope key is formed. `product` is the ADR-0063 axis (`ask` | `build`),
  derived from the resolved agent — never a per-surface choice.
- `StudioAiCopilot` and the full-page `AiChatPage` both resolve
  `app:${packageId}:${product}` for a package-scoped surface (the Studio copilot
  editing package X and the `/ai/build?package=X` "Edit with AI" focus view now
  resume ONE shared thread). The legacy `studio:` surface prefix is dropped.
- A generic `/ai/:agent` visit with no `?package=` degrades to the product alone
  (`build` / `ask`) — unchanged behaviour for that surface.

Enablement stays on the single access-filtered agent-catalog gate
(`useAiSurfaceEnabled`, ADR-0068) — a seat-less user's empty catalog hides the
whole AI surface. No layout change.
