---
---

Docs and gate ledger only — this publishes nothing, declared explicitly with an empty
frontmatter rather than left undeclared.

`content/docs/utilities/index.md`'s "Data Integration" section taught
`import { ObjectStackProvider } from '@object-ui/data-objectstack'`, a React context
provider on a package that is headless and exports no such thing. Compiled against the
built `dist/index.d.ts` by the same harness `scripts/check-doc-snippet-types.mjs` uses,
the block read
`TS2724: '"@object-ui/data-objectstack"' has no exported member named 'ObjectStackProvider'`,
so a reader who copied it did not get a runtime bug — they got a compile error. #4124 had
already established the finding and PR #4129 fixed it on the sibling page
`content/docs/utilities/data-objectstack.mdx`; the identical phantom survived one file
over, in the utilities index, outside that card's file surface.

The section now teaches the same shape PR #4129 established: `createObjectStackAdapter`
returning a plain `DataSource`, injected at the renderer boundary through
`@object-ui/react`'s `SchemaRendererProvider`. The block is also self-contained — it
imports every name it uses and types its schema literal as the real `ObjectGridSchema` —
so it compiles exactly as a reader who copies that one block experiences it.

Because that was the page's only `ts`/`tsx` block and it now produces zero diagnostics,
`content/docs/utilities/index.md` LEAVES `check-doc-snippet-types.mjs`'s `UNGATED_DOCS`
ledger instead of getting a re-measured reason: the page is compiled by the gate from
here on, and no entry on that ledger names a missing export any more.
