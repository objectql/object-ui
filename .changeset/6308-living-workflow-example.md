---
---

Docs change; no published surface.

`content/docs/guide/ci-cd-pipeline.md`'s "Adding a New Workflow" section told a
contributor to "follow the existing pattern for pnpm + Turbo setup" and then gave a copied
YAML block in which every line had drifted: `actions/setup-node@v4` where every workflow
in this repository now uses `@v7`, a hardcoded `node-version: 20` where every workflow
declares `'22.x'` (and 20 sits below the floor the root `package.json`'s `engines` field
now declares), and `pnpm/action-setup@v4`, which no workflow here has ever used — pnpm
comes from `corepack enable` plus the root `packageManager` field instead. Re-measured on
this change's own HEAD: `actions/setup-node@v7` — 28 occurrences, no other version;
`node-version:` — 27 `'22.x'` and 1 `'22'`; `pnpm/action-setup` — 0.

A copied block is a fossil by construction, so the section now points at
`readme-exports.yml` as a living example instead of repeating one: it is short, runs on
every pull request, and its setup is the complete pattern most new build/test/lint
workflows need (checkout, `corepack enable`, `actions/setup-node` with pnpm's cache,
`pnpm install --frozen-lockfile`, then a `turbo run build` step). Only the two steps that
hold regardless of which Node or pnpm version the repository is on — the checkout step and
`corepack enable` — stay quoted on the page; the reader copies the version-specific steps
from the workflow itself. No new version literal was introduced, so no
`doc-version-claims.test.ts` `KNOWN_CLAIMS` entry was needed.

objectui#6308.
