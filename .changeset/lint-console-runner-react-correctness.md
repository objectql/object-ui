---
"@object-ui/console": patch
"@object-ui/runner": patch
---

fix(console,runner): the approvals inbox renders against one ticking clock, and both packages now run ESLint

`apps/console` and `packages/runner` had no `lint` script, so `turbo run lint`
skipped them silently and their 17 ESLint **errors** had never been seen
(#2923 declared them as DEBT; this closes the gap). Both now carry
`"lint": "eslint ."` and the `DEBT` list in `scripts/check-lint-coverage.mjs`
is empty — every workspace package is linted.

What the errors actually were, once read one by one:

- **8x `react-hooks/purity` — real, and user-visible.** The approvals inbox
  read `Date.now()` mid-render for every age tint, "5m ago" label and SLA chip.
  Render must be pure: the output depended on when React happened to render, so
  it disagreed with itself under StrictMode's double render and then **froze** —
  an inbox left open kept saying "just now" and an SLA countdown never counted
  down. The page now renders against a single `now` held in state and advanced
  once a minute (the finest granularity anything here displays), so render is a
  pure function of props+state *and* the figures actually tick.
- Alongside that, `sla_due_at` is now parsed through a guard. A due date the
  backend sends in a shape `Date.parse` can't read used to render as
  "SLA NaNh left"; it now renders nothing.
- **1x `react-hooks/static-components` — real.** `StatusBadge` was declared
  inside `ApprovalsInboxPage`, making it a brand-new component type on every
  render, so React unmounted and remounted every status chip in the table each
  time the page re-rendered. Hoisted to module scope, with the translated label
  passed as a prop.
- **6x `react-hooks/static-components` — false positives** (3 in the console's
  settings pages, 3 in the runner's `LayoutRenderer`). All six render the result
  of `getIcon`/`getLazyIcon`, which memoises per name in a module-level cache —
  the component reference is stable across renders and nothing is created during
  render. The rule cannot see through the call, so these carry the same targeted
  `eslint-disable-next-line` + justification the repo already uses at a dozen
  icon-registry sites, and the resolvers themselves now say so in a comment.
  (Verified rather than assumed: typing into a settings field keeps focus and
  every character, so no state was ever being reset there.)
- **2 minor.** A dead `token` initializer on the console's auth preflight path
  (`no-useless-assignment` — read, not blind-deleted: no intended write was
  missing, every path out of the try/catch either assigns or returns), and a
  `prefer-const` in the SDUI workbench preview.
