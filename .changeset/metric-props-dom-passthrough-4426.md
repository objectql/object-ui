---
'@object-ui/plugin-dashboard': minor
---

`MetricWidgetProps` / `MetricCardProps` declare the DOM pass-through their spread has always accepted

Both KPI components end their prop list with a `...domProps` spread onto the Shadcn `Card`, and objectui#4357 (PR #4428) kept that spread deliberately — it is their only accessibility pass-through, and removing it would delete the only way a host can put an `id`, a `role` or an `aria-label` on a KPI card. Neither props interface declared any of it. So the type refused what the runtime accepted: a JS consumer, and every SDUI author going through `SchemaRenderer` (untyped at that boundary), got the pass-through, while a TypeScript consumer importing the component directly got `error TS2322` on `id` / `role` / `aria-label` and needed a cast.

`MetricWidgetProps` now extends `React.HTMLAttributes<HTMLDivElement>`, and `MetricCardProps` extends the same minus `title`. That is the repo's measured convention for an exported props interface that spreads onto a host element (`PageHeaderComponentProps`, `ChatbotProps`, `ChatbotEnhancedProps`, `TypingIndicatorProps`, `RefreshIndicatorProps`, `FieldProps`, and shadcn's `BadgeProps`), and the `Omit` carve-out is `ComboboxProps`'s spelling for a name the component's own contract owns.

Graded `minor` rather than `patch` per the objectui#4403 precedent: two exported interfaces widen. The widening is purely additive for existing callers — every prop that compiled before still compiles, and nothing narrows — so no source change is required to upgrade.

Semantics worth knowing, because both are contract statements rather than incidental:

- **`MetricCard.title` stays the heading.** HTML's `title` is a tooltip; this card's `title` is its heading, in the `I18nLabel` vocabulary, destructured out and rendered into `CardTitle`. No `title` attribute has ever reached this element, so the inherited DOM `title` is omitted rather than declared and silently dropped — the "declared but not delivered" failure this repo treats as first-class (objectui#3290, objectui#3222). `MetricWidget` has no such collision (its heading is `label`) and extends the DOM attributes whole.
- **`MetricWidget.onClick` stays zero-arg**, narrower than the inherited `MouseEventHandler`, because the same handler is wired to Enter/Space where there is no mouse event to hand over. A zero-arg function is assignable to the inherited signature, so callers already passing `(e) => …` keep compiling.

Not declared, deliberately: the schema-shaped keys `SchemaRenderer` injects (`schema` / `bind` / `events` / `props` / `ariaLabel` / `ariaDescribedBy` / `dataSource`). None is an HTML attribute name, all seven are destructured out before the spread, and declaring them would re-assert as public contract exactly what PR #4428 stripped from the DOM. They stay in `SchemaHostProps`, intersected in at each component's own signature — accepted so the renderer can inject them, never part of the documented authoring surface.

Zero runtime change: no component body was touched, and PR #4428's pins pass untouched.
