---
'@object-ui/plugin-chatbot': patch
---

**Read the agent catalog in the declared envelope too, before the server converts.**

`GET /api/v1/ai/agents` is served by two producers — the framework dispatcher's
degraded fallback when no AI service is registered, and cloud's `service-ai` — and
it is one of the last SDK-addressable routes still answering outside the platform's
declared `{ success: true, data }` envelope (objectstack#4053). `useAgents` read
only `{ agents }` and a bare array, so the day either producer converts, the parse
would miss.

That miss is unusually dangerous on this particular route, which is why it is worth
getting ahead of rather than fixing after. The catalog is not just data:
`useAiSurfaceEnabled` gates the **entire AI surface** on `agents.length > 0`,
because the route is access-filtered per caller and is therefore the only signal
that is both edition- and user-aware (ADR-0068). An empty list is the correct
answer for a seat-less user or a Community-Edition deployment with no `service-ai`
— so a parse miss and the legitimate hidden state are **indistinguishable**: no
error, no 403, no log, just the FAB, the top-bar link and the designer's "Ask AI"
quietly gone for everyone.

`extractAgentList` now folds all four shapes to the same list — a bare array,
`{ agents }`, `{ success: true, data: [...] }`, and `{ success: true, data:
{ agents } }` — detecting the envelope the way `ObjectStackClient.unwrapResponse`
does (a **boolean** `success`), so the two readers cannot disagree about what
counts as one. Nine tests cover it; reverting to the previous two-shape read fails
five of them.

No behaviour change against any server shipping today: the shapes that worked
before still parse identically. This only removes the lockstep requirement, so the
server side can convert on its own schedule.
