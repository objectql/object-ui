---
"@object-ui/sdui-parser": patch
---

A declared `objectName` must reach the data layer — the evidence the framework's spec↔registry check cannot gather (objectstack#4472).

The framework diffs `sdui.manifest.json` against the spec's zod schemas and, while that
check was named `check:react-conformance`, it was read — by its own file header — as
confirming these components "ACTUALLY implement" the spec's props. It never could. Both
sides of that diff are **declarations**, and this repo produces one of them:
`manifestFromConfigs` copies `config.inputs` verbatim and cannot observe whether the
renderer behind a block reads any of them. So a prop both sides declare and nothing
consumes reads there as agreement — which is how objectstack#4413's four `record:*` blocks
published an `objectName`/`recordId` no renderer read, rendered blank, and stayed green.

Evidence about the render path has to be taken from the render path, so it lives here now.
`apps/console/src/__tests__/public-block-binding-reach.test.tsx` mounts every public block
that declares an `objectName` input through `SchemaRenderer` with nothing but that binding,
under a provider whose `dataSource` is a Proxy recording every call, and asserts some call
carried the object name. Deliberately narrow — "is this binding wired", not "is every
declared input consumed", which is not decidable from outside without heuristics. Every
non-reaching block carries a written reason in a ledger asserted to equal the observed set
in **both** directions, so a block that starts binding forces its entry deleted and a block
that stops binding fails; the suite was verified to go red both ways.

First run: five of eight bound blocks reach the data layer, three do not.
`record:related_list` legitimately declines to fetch without the parent record id from
`RecordContext` (already documented in @objectstack/spec's objectstack#4413 ledger).
`list-view` and `embeddable-form` do not, and that is a real defect of the same shape —
neither registration bridges the schema-renderer context onto the component's `dataSource`
prop the way `object-form` / `object-kanban` / `object-calendar` do, and `SchemaRenderer`
never injects it, so on the registry/SDUI path both render an empty shell while declaring
`objectName` **required**. Filed as objectui#3144 rather than fixed here: giving them a
data source changes what they render everywhere they are mounted bare.

`manifestFromConfigs` and `scripts/dump-public-manifest.mjs` now say in their own docs that
what they emit is what a registration *declared*, never what a renderer reads.
