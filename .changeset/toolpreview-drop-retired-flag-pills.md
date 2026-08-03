---
"@object-ui/app-shell": patch
---

`ToolPreview` stops advertising retired `ToolSchema` flags (objectui#3236).

The metadata-admin tool preview painted a header strip of flag pills read
straight off the raw draft: `Requires confirmation`, `Active` / `Disabled`,
`built-in`, and the `category` tag. All four keys have been removed from
`@objectstack/spec`'s `ToolSchema` — `requiresConfirmation` in the 16.x line
(objectstack#3715, ADR-0033 §2) and `category` / `active` / `builtIn` in
17.0.0 (objectstack#3896 audit close-out). The schema is `.strict()` and now
rejects each by name with an upgrade prescription, so no newly authored tool
can carry them; verified against the `@objectstack/spec@17.0.0-rc.1` this repo
depends on.

New metadata could not reach these pills — but rows stored before the removals
still carry the keys, and for those the preview kept rendering. That is the
harmful direction, not a cosmetic one:

- `Requires confirmation` advertised a safety pause that no execution path has
  ever performed. Nothing read the key — not the LLM tool set (a tool reaches
  the model as name/description/parameters only), not `ToolRegistry.execute`,
  not `POST /ai/tools/:name/execute`. A reviewer reading the preview saw a
  destructive tool marked as gated when it was not. The real gate is
  `action.ai.requiresConfirmation`, which the HITL approval queue reads.
- `Disabled` claimed a tool had been withdrawn while `ToolRegistry.getAll()`
  kept handing it to the LLM and the execute route kept running it.

Same shape as objectui#2962: a UI badge advertising a capability the runtime
does not have. The pills are gone; the surviving header strip shows label,
machine name and the `objectName` pill (`objectName` is still a live spec key),
and nothing else in the preview changed — parameters table, example LLM call
and output schema are untouched.

New tests feed the preview a stale draft that still carries all four retired
keys and assert none of them renders, so the pills cannot grow back: the names
survive in the spec's tombstone guidance, which gives the next reader a
plausible-looking reason to "restore" them.
