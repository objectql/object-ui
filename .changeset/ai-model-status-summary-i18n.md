---
"@object-ui/i18n": patch
"@object-ui/app-shell": patch
---

fix(i18n): compose the AI-model diagnostics summary client-side instead of rendering the server's English string (objectui#2886)

`CloudAiModelStatus` rendered `report.summary` verbatim — the most prominent
line on the panel, in English for every locale.

Reading `objectstack-ai/cloud` settled how to fix it. The server **cannot**
localize that string as currently built:

- `service-ai/src/effective-model.ts:117` assembles it as a hard-coded English
  template literal, with no locale parameter;
- `service-ai/src/routes/ai-routes.ts:395` declares `handler: async () => …` —
  it takes **no request argument**, so it cannot read `Accept-Language` even
  though `createAuthenticatedFetch` has been sending it since objectui#1319.

But no server change is needed, because every ingredient of the sentence is
already in the structured payload: `conversational.model`,
`conversational.source`, `structured.model`, `structured.pinned`, and
`routing.{free,paid}`. The issue proposed "return structured data instead of a
sentence" as the better fix — the server was already doing that; the client
just wasn't using it.

The panel now composes the line from those fields. `sourceLabel()` already
produced exactly the two clauses the server hand-rolls — "pinned by X" /
"code default (no env override)", and "same as build/ask" for an unpinned
structured model — so no new source vocabulary was required.

**A dropped diagnostic, not just untranslated text.** The client's
`EffectiveModelReport` never declared `routing`, which the server has always
sent conditionally. Its only appearance anywhere was inside the English summary,
so non-English admins could not see the plan→model routing policy **at all**.
It is now declared and surfaced.

Also fixed: `attributeSource` emits the bare token `'unknown'` when the adapter
cannot report a model, and `sourceLabel` fell through to rendering it raw.

Four keys added to all ten packs (`summary`, `summaryRouting`, `modelUnknown`,
`sourceUnknown`), so the full-parity guard from objectui#2909 stays green.

The panel had **no test coverage at all**; it now has five, mutation-tested by
restoring `<p>{report.summary}</p>` — which fails four of them.
