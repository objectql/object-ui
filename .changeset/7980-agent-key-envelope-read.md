---
'@object-ui/app-shell': minor
'@object-ui/console': patch
---

Publish `readEnvelopeFailureText` from `@object-ui/app-shell`, and read the agent-key
generator's failures through it (objectui#7980, maintainer ruling relayed by the director
seat, decision batch #91 — option B).

**New export, no new behaviour.** `readEnvelopeFailureText(payload)` is the single read of
the ADR-0112 failure envelope: a producer-marked `error.userMessage` outranks the
diagnostic `error.message` at any status, `error.code` is appended to whichever prose won,
and a body carrying no prose answers `null` so each caller keeps its own fallback. The
function is unchanged — it has been in this package since objectui#7959 and is pinned by
`utils/apiErrorEnvelope.test.ts`; this only publishes it. It returns `string | null`, so
no type accompanies it, and its module imports nothing, so it adds no module side effect.

objectui#7959 kept it off the public entry as **scope restraint** — that card's file
surface was `packages/app-shell/**` — not as a ruling that it should stay private.

**The console fix this unblocks.** The Integrations page's "Connect an AI agent" section
read `json?.error?.message` and stopped, so a refused key mint dropped two declared
things: the producer's marked `error.userMessage` (the #9934 channel, whose presence *is*
the marking) and `error.code`. The 5xx band is where that cost most — the producing door
substitutes the generic `Internal server error` into `message` while the mark rides
through untouched, so a marked 500/503 showed the developer the generic sentence and
discarded the specific one written for them, and no code reached the surface at all. The
section now reads the envelope through the shared rule and renders what the producer
marked.

Unmarked refusals — the overwhelmingly common case — render the same diagnostic prose as
before, now with the declared `error.code` appended.
