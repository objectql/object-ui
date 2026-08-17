---
---

Tooling + docs-only (objectui#4823). Every `type` string literal in a `content/docs/**.mdx`
code block must now name a component the repository actually registers, enforced by a new CI
gate — `pnpm check:doc-types`, `scripts/check-doc-component-types.mjs`, in its own
`doc-component-types.yml` workflow.

The catalog side has had this ratchet since objectui#4616:
`examples/schema-catalog/test/catalog-gallery-render.test.tsx` renders every catalog entry and
fails if any paints the registry's "Unknown component type" panel (OBJUI-001). The teaching
surface had no equivalent — a fenced snippet in `content/docs/**` is not rendered, not parsed
and not compared against anything — so a page could teach a `type` that does not exist and
every check in the repo stayed green. The same defect landed three times on that surface
(objectui#4786 `stats-card`, objectui#4796 `plugin:grid` and `plugin:map`), each found by a
human probe rather than by a check.

The registered-key universe is derived from the register calls themselves on every run — no
hard-coded list and no build step, so the gate is a checkout plus one `node` call and can
therefore run unfiltered, which matters because the change that introduces this defect is
docs-only and `ci.yml`'s gates skip those by design.

The first full scan read 558 `type` literals across 143 pages against 661 derived keys and
found three more instances of the same shape, fixed here: `content/docs/utilities/runner.mdx`
and `content/docs/utilities/vscode-extension.mdx` taught `heading`, which nothing registers
(now `h1`, which `html-elements.tsx` registers and which renders the node's `children`), and
`content/docs/plugins/plugin-form.mdx` taught a `multi-step-form` type that appears nowhere in
the repo outside that snippet (now the `object-form` + `formType: 'wizard'` + `sections` shape
that `WizardFormSchema` itself declares).

No published behaviour changes — repo tooling plus three documentation snippets — so this
declares "no release" rather than a bump.
