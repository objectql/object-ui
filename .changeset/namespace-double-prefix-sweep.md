---
"@object-ui/components": patch
"@object-ui/console": patch
---

fix(registry): prefix every namespaced key exactly once, in every namespace

objectui#3023 fixed eleven `record:*` blocks registered as
`register('record:x', …, { namespace: 'record' })` — an already-prefixed name
handed to a registry that prefixes it again, landing the block at
`record:record:x` — and guarded that namespace alone. Twenty-two more were
sitting in `action:` (5), `element:` (10) and `page:` (7), two of them
(`page:header`, `element:divider`) curated public blocks.

Checking one namespace is exactly what let them keep sitting there, so the
guard now asks the whole registry rather than a prefix of it.

Same fix as before: register the bare name and let `namespace` do the
prefixing, with `skipFallback: true` so the fallback does not claim that bare
name globally. It would otherwise take over `header`, `footer`, `sidebar`,
`tabs`, `card`, `accordion`, `section`, `text`, `image`, `button`, `icon` —
every one of which belongs to `ui:`. All 22 stay reachable exactly as
`<namespace>:<name>`; the registry goes 522 keys to 500, and the contract is
unchanged at 42/42.

Found while probing why six curated Tier B primitives report no `inputs`. They
do declare them — `vitest.setup.dom.tsx` registers simplified `text` / `image` /
`html` / `grid` stubs that shadow the real registrations inside the test
environment only. That shadowing is a separate question, left alone here; the
doubled keys it turned up are not test-environment artifacts.
