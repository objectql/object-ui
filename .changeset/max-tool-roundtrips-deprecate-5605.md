---
'@object-ui/plugin-chatbot': patch
'@object-ui/types': patch
---

`maxToolRoundtrips` on `ChatbotSchema` is deprecated: it is inert, and an author
who sets it is now told so instead of being left believing the documented cap
applies (objectui#5605).

The key was declared authorable in `@object-ui/types` (interface and zod, with a
description), threaded from the authored document through the chatbot renderer at
three call sites, accepted by `useObjectChat`, given a default — and then dropped.
Measuring the installed chat runtime says it cannot be honoured from here rather
than that someone forgot to wire it: `@ai-sdk/react`'s `useChat` takes `ChatInit`
plus throttle/resume, and `ChatInit` declares exactly one loop control — the
boolean predicate `sendAutomaticallyWhen` — and no numeric cap under any
spelling. The numeric knob was removed from `useChat` in a major, and its
successor was renamed through `continueUntil` to `stopWhen` / `stepCountIs`,
which the installed `ai` package declares only on `generateText`, `streamText`
and the tool-loop agent settings — all server-side. ObjectUI is backend-agnostic,
so it owns no server loop to cap either, and putting the number in the request
body would only move the same dead key one hop onto a wire contract no backend
reads.

This is stage one of a two-stage retirement, so nothing an author already wrote
breaks: the key still parses, still carries its declared shape, and the renderer
still threads it. What changes is that it is now marked `@deprecated` in the
interface, the zod description and the docs, and that authoring it logs a
one-time notice naming the knob that does work — `planning.maxIterations` on the
agent. A follow-up removes the declaration once this deprecation has shipped in a
release.
