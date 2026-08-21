---
'@object-ui/react': patch
---

`toRenderableSchema`'s header now says the bridge is permanent, instead of instructing
callers to remove it (objectui#4622).

Comment-only — the emitted JavaScript is byte-identical. The paragraph nonetheless ships:
this package builds with plain `tsc`, so the JSDoc is carried into
`dist/schema-input.d.ts` and is what an editor shows on hover at every call site.

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
