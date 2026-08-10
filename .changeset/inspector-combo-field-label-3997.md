---
'@object-ui/app-shell': patch
---

Name the `InspectorComboField` trigger: the visible label now owns it, and an anonymous combo no longer compiles (objectui#3997).

This is the fourth inspector field atom with the shape PR #3996 fixed for the three in `_shared.tsx` — a `Label` rendered as a plain sibling of the control, with no `htmlFor`, no `id` and no `aria-label`. It lives in its own module, so it stayed broken after the other three were closed. The label and the `button[role=combobox]` were adjacent only visually: assistive tech announced an anonymous combobox with the field name floating above it as unowned text, `getByLabelText` could not reach it, and clicking the visible label did nothing. It renders at eighteen call sites across the object-field, dataset, dashboard-widget, app-nav and view-variant inspectors (lookup display/description fields, `lookupFilters` rows, summary aggregates, dataset dimensions and measures, nav targets), so it is on screen the moment any of those panels opens.

The labelled branch closes the pair the same way the other atoms do: `React.useId()` mints the id inside the atom, `Label` gets the `htmlFor`, and the id lands on the trigger `Button` that `PopoverTrigger asChild` renders. Never on `Popover` — Radix's `Popover.Root` is a context provider that renders no DOM element, so an id handed to it is dropped silently and the `for` dangles, which is the objectui#3976 / #3994 mistake this repo has now paid for twice.

`label` was optional, and the un-labelled branch was the same defect one notch worse: a combobox with no name at all. Five of the eighteen call sites had authored exactly that. Rather than adding a lenient fallback (synthesising a name from the placeholder would have produced "Select…" as the announced name), naming became a type-level requirement of exactly one of three channels:

- `label` — the atom renders the visible label and owns the association. Unchanged for the thirteen call sites that already passed one.
- `ariaLabel` — for repeated rows where no visible label exists and one would break the grid: an app-nav URL filter's `field = value` pair, a dataset's list of joined relationships, the dependent-lookup "add a field" picker.
- `id` — for when an external `Label htmlFor` already owns the naming. `DashboardWidgetInspector` wraps its controls in a `Field` that renders `Label htmlFor={id}` and hands the same id to the control; every other field honoured it (`Input id`, `SelectTrigger id`) but the dataset combo could not, because the atom accepted no id. That `for` pointed at an id nothing carried — a dangling IDREF, worse than an unnamed control, because tooling reports an association that resolves to nothing.

Zero channels and two channels are now both unauthorable: zero is anonymous, and two is the double-announcement failure objectui#3961/#3978 exists to avoid. Neither has a runtime symptom the component could detect and report — an unnamed combobox renders, lays out and commits values perfectly, and is wrong only for the users who cannot see it — so the check is compile-time or nothing. It is pinned in `InspectorComboField.naming.types.test.tsx`, listed in `tsconfig.typetests.json` so a compiler actually reads it.

One new pair of strings (`engine.inspector.widget.filterBindingField`, en-US + zh-CN) names the per-filter binding combo in the dashboard widget inspector, which sits under a heading that captions its whole row rather than the combo alone.
