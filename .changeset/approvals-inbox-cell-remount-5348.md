---
'@object-ui/console': patch
---

The Approvals Inbox stops remounting every row on every render.

`ApprovalsInboxPage` declared `RequestCell`, `RecordCell` and `InlineActions`
inside its own component body. React identifies a component by the identity of
its function, so each render produced three brand-new component *types* and React
unmounted and remounted every row's subtree instead of updating it — and the page
holds its clock in state and ticks it every 60s, so this fired on a timer whether
or not anyone was touching the page (objectui#5348).

Two consequences were reproduced against `origin/main` before the fix, in
`apps/console/src/pages/system/ApprovalsInboxPage.cellIdentity.test.tsx`:

- **Transient subtree state is discarded.** Focus placed on a row's Approve
  button moved to `<body>` on the next clock tick.
- **Input is silently swallowed.** A pointer sequence that spans a re-render —
  press, tick, release — left the confirmation dialog unopened: the captured node
  had been replaced, so React's delegated listener never saw the click. This is
  the failure objectui#5211 hit and worked around at its call site
  (`Unable to find role="alertdialog"`).

The three cells are now at module scope beside `StatusBadge`, which was moved
there for the same reason and already carries the explanation. Everything they
closed over is passed in: `RequestCell` and `InlineActions` take the page's
scoped translator, and `RecordCell` takes `href: string | null` — one prop rather
than two, so the objectui#5211 readable/unreadable decision and the URL cannot be
handed in disagreeing with each other.

The verification asserts the consequence, not the placement. A test that checks
the three functions now sit at module scope stays green for a refactor that moves
them and introduces a fourth inline component beside them; these cases compare
DOM-node identity for all three cells across a clock tick, which no remount can
pass, and re-drive the swallowed click.

That guard is load-bearing because lint cannot supply one here.
`react-hooks/static-components` exists for exactly this class and is `error` in
this repo via the plugin's recommended set, yet it reports nothing on this page:
measured on `origin/main`, an arrow-form inner component injected into
`ApprovalsInboxPage` and used in JSX produced **zero** reports, while the same
shape in a ten-line file produced two. The rule's analysis bails out on this
component, which is how three of them shipped.
