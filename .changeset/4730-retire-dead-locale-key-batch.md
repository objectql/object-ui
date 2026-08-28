---
'@object-ui/i18n': minor
---

Retire 25 confirmed-dead locale keys from all ten packs — 250 translated strings
with no reader anywhere in the repo (objectui#4730's key-level trim round;
`calendar.agenda` closes objectui#5783).

Every key was confirmed individually, not swept from a tool's output. The
inventory comes from `scripts/check-i18n-dead-keys.mjs`, which stays report-only
by design, and each candidate then had to clear the objectui#4658 evidence
standard on its own: zero `t()` call sites, zero textual footprint anywhere
outside the packs, and a read of its plausible consumer confirming no i18n
wiring reaches it. Five namespaces held nothing but retired leaves and went with
them — `map`, `cellRender`, `rowAction`, `recordDetail`, and `home.stats`.

The retirements fall into three shapes:

- **Superseded twin vocabularies.** `cellRender.*` and `rowAction.*` duplicated
  a `grid.*` vocabulary that won. `RowActionMenu.tsx` is fully i18n-wired and
  reads `grid.openMenu` / `grid.edit` / `grid.delete`; `ObjectGrid.tsx` reads
  `grid.empty` / `grid.yes` / `grid.no` / `grid.systemFields`. The twins had no
  reader on either side.
- **Labels that outlived their control.** `calendar.agenda` labelled a view mode
  objectui#5740 retired from `CalendarViewMode` (now `'month' | 'week' | 'day'`).
  `home.quickActions.createApp*`, `layout.systemNav.createApp`,
  `actionDialog.defaultActionTitle` / `.ok` and `grid.bulk.selectPlaceholder`
  sit in namespaces whose consumers are live and wired but demonstrably read
  other siblings.
- **Surfaces that left the product.** `map.*` is the strongest form:
  `@object-ui/plugin-map` declares no `@object-ui/i18n` dependency and contains
  no `t()` call at all, so it cannot consume a locale string. `home.stats.*` and
  `recordDetail.viewersTooltip` name surfaces nothing renders.

`packages/i18n/src/__tests__/dead-key-batch-retired-4730.test.ts` pins the
retirement, following the convention of the five retirement pins already in that
directory. It is load-bearing rather than decorative: every i18n gate in this
repo runs call site to key, so a dead key coming **back** into the packs is
invisible to all of them, and this pin is the only thing watching that direction.

**Deliberately NOT deleted, and pinned as live.** Seven `console.*` bootstrap
strings that this same sweep reported CONFIRMED-dead are in fact **live**, and
were pulled back out of the batch. `LoadingScreen.tsx` is bootstrap-critical UI
that must render before i18n loads — precisely when the server is unreachable —
so it deliberately does not call `t()`. It imports the packs directly and reads
them as plain object properties (`strings.loadingSteps.connecting`). That
consumer is invisible to both legs of the sweep: there is no call for the AST
pass to classify, and the full dotted key is never spelled in source because the
namespace segment is bound to a local variable. The new pin asserts those keys
stay, so the next sweep round cannot repeat the mistake.
