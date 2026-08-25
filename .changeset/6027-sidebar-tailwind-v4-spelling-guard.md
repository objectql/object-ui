---
---

Tests only; no published behaviour changes.

Adds an offline assertion that the shipped
`packages/components/src/ui/sidebar.tsx` contains no Tailwind **v3**
`[--var]` arbitrary values, wired into the existing
`scripts/__tests__/shadcn-local-patches.test.ts` suite (no new workflow).

The Tailwind v4 custom-property migration (`925051db6`) is an *undeclared*
local edit — prose in `shadcn-components.json` (`localEdits`), with nothing in
`scripts/shadcn-local-patches.mjs` re-applying it — so a `--force` sync drops
it. It is the only one of `sheet`/`sidebar`'s four undeclared edits that no
gate catches: the v3 spelling compiles, renders, and emits invalid CSS that
browsers silently discard. The assertion closes that silence from the cheap
side rather than declaring ~20 class-string anchors.

Asserted against the file the repo **ships**, not a vendored fixture — the
regression being guarded is "a forced sync overwrote the shipped file", which a
fixture-based check would pass straight through. The block also guards the
inverse (the correct v4 `(--var)` spellings must not trip it) and pins the
tolerated/refused counts, and its docblock records the other three undeclared
edits with the gate that catches each.
