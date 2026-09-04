---
'@object-ui/types': minor
---

**Published TS surface narrowed:** `DashboardComponentSchema` no longer declares the
dashboard-root `title` member (objectui#7623).

Its doc comment said "Dashboard title displayed in the header", and that stopped being
true one release earlier: objectui#7509 retired all five dashboard-root `title` read
arms under ADR-0049, leaving the key declared, documented as rendering, and inert. The
header text is the spec-canonical `label` on `BaseSchema`, resolved through
`pickLocalized`.

What an author loses is the **type-level suggestion** only, and there is **no runtime
and no validation behaviour change**. `BaseSchema`'s index signature means an existing
`title:` line still compiles; objectui's Zod twin extends `.passthrough()` `BaseSchema`,
so it parsed a root `title` before this release and still does; and a document validated
against `@objectstack/spec`'s strict `DashboardSchema` was already refused there
(`unrecognized_keys: ['title']`) long before it reached a renderer. Nothing that rendered
stops rendering — the read arms were already gone.

**Unlike `aria` (objectui#5830), no tombstone comes with this.** The spec refuses a root
`title` as an unrecognized key, not with a named removal message, so there is nothing to
inherit by reference and none was invented; the pin
(`packages/types/src/__tests__/dashboard-title-retired-declaration.test.ts`) asserts the
key-set half only — `title` is out of the interface's declared members while `columns`,
`widgets` and `header` stay in.

**Not affected, despite the shared name:** widget-level `DashboardWidget.title` — the
spec's `I18nLabel` on a different receiver, live, declared and read by
`DashboardRenderer`, `DashboardGridLayout` and `DashboardWithConfig`. The pin carries it
as an explicit control.

**Migration:** delete a dashboard-root `title` from any authored dashboard and use
`label` (it accepts a string or a per-locale map). Widget titles are unchanged.
