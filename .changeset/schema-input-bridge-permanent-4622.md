---
'@object-ui/react': patch
---

`toRenderableSchema`'s header now says the bridge is permanent, instead of instructing
callers to remove it (objectui#4622).

No executable line changes — but the artifact is **not** unchanged, and that is worth
stating plainly rather than rounding to "comment-only". This package builds with plain
`tsc`, and `tsconfig.base.json` sets `"removeComments": false` deliberately, so the JSDoc
is emitted into `dist/schema-input.js` as well as `dist/schema-input.d.ts` — it is both
what an editor shows on hover at every call site and bytes that ship.

Measured by building the package the way the repo builds it, at both revisions:
`dist/schema-input.js` grows from 1,486 to 2,316 bytes (1.45 KB to 2.26 KB), and from 850
to 1,246 bytes gzipped (0.83 KB to 1.22 KB) — **+830 bytes raw, +396 gzipped**. All 18
differing lines in the emitted file are JSDoc continuations and the three executable lines
are byte-identical, so the growth is the paragraph and nothing else. The trade is
deliberate: roughly 0.4 KB gzipped, against the five-hour `Build Docs` outage the old
paragraph's instruction produced once already.

The old closing paragraph said the two competing repo-wide `SchemaNode` spellings "have
not been reconciled" and that "when it lands, the call sites using this can go back to
forwarding directly". Both halves went false when PR #4608 merged, and the second half is
the harmful one: it is an instruction whose trigger condition has now fired, sitting
directly above the function a future author is about to call.

The reconciliation (objectui#4580 / PR #4608) resolved the collision in favour of
`@object-ui/types`' union — `@object-ui/core` now re-exports it rather than hand-declaring
an interface — while `SchemaRenderer`'s prop stays deliberately narrow per objectui#4548
ruling Q2 (`schema: BaseSchema | string | null | undefined`, no `number` / `boolean`). So
a `SchemaNode` became *less* assignable to that prop, not more, and the bridge is a
permanent crossing between two intentionally different types rather than scaffolding
awaiting a merge.

Following the old instruction has a measured cost: five `apps/site` call sites were
forwarding directly when PR #4608 landed, and `Build Docs` was red on `main` for roughly
five hours until PR #4621 routed all five through this function (objectui#4617).
