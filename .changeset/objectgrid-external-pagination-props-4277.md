---
'@object-ui/plugin-grid': minor
---

ObjectGrid's host-driven pagination mode is a declared interface instead of twelve `(rest as any)` reads

`ObjectGridProps` declared twelve members while the component read twelve more out of `...rest`, each through an `as any` cast: `data`, `manualPagination`, `rowCount`, `page`, `pageSize`, `onPageChange`, `onPageSizeChange`, `sort`, `onSortChange`, `search`, `onSearchChange` and `onColumnStateChange`. They are not accidental — together they are the host-driven external-pagination path from framework#2212, where a host has already fetched one window of a larger collection and drives the page/sort/search controls itself, and the component's own comment said so. They were simply declared nowhere, so no call site could be checked against them and no editor could offer them.

Nothing had caught it because the only untyped caller is `ObjectGridRenderer`, whose `{ schema: any; [key: string]: any }` index signature accepts anything; every typed caller happens to pass only declared props; and the test that exercises the path was compiled by nothing.

They now live on a named `ObjectGridExternalPaginationProps`, which `ObjectGridProps` extends — a separate interface rather than twelve more members flattened into the authoring surface, so the "advanced host-driven mode" boundary stays visible. The eleven members that already have a counterpart on `DataTableSchema` — the type ObjectGrid forwards them to — are **type-derived** from that declaration (`Partial< Pick< DataTableSchema, … > >`) rather than hand-copied, so the two cannot drift apart; only `onColumnStateChange` is declared explicitly, because the table vocabulary reports per-event `onColumnResize` / `onColumnReorder` rather than the merged `{ order, widths }` layout this reports. `ObjectGridColumnState` is exported for that payload.

Purely additive for callers: every member is optional, so existing code compiles unchanged, and hosts that were already passing these props now get them checked instead of silently accepted. Runtime behavior is unchanged.
