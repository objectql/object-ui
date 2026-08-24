---
'@object-ui/types': minor
---

**`@object-ui/types/zod` now accepts seven spellings its own TypeScript declarations already declared**

Seven keys across five hand-written zod mirrors refused values the published TS
types invite and the renderer implements — `declared !== enforced` on a published
validator. The mirrors are widened to their declarations. Nothing is narrowed and
nothing previously accepted is rejected, so this is additive for every author and
every host: schemas that parsed before still parse.

The newly-accepted spellings, so a host can search for them:

| schema (`@object-ui/types/zod`) | key | now also accepts |
|---|---|---|
| `ButtonGroupSchema` | `variant` | `secondary`, `destructive`, `ghost`, `link` |
| `ButtonGroupSchema` | `size` | `icon` |
| `ObjectChartSchema` | `chartType` | `column`, `horizontal-bar`, `donut` |
| `FormSchema` | `validationMode` | `onTouched`, `all` |
| `SelectSchema` | `defaultValue`, `value` | `boolean` |
| `DataTableSchema` | `selectable` | `'single'`, `'multiple'` (alongside `boolean`) |
| `ViewSwitcherSchema` / `ViewTypeSchema` | `defaultView`, `activeView`, `views[].type` | `chart` |

**Each one was decided by measuring the renderer, not by matching the declaration.**
Widening a mirror to its declaration is only correct where the running code
implements the missing spelling; where a spelling is dead, the right fix is to
withdraw it from the declaration (ADR-0049 enforce-or-remove), not to teach the
validator to accept something that renders nothing. The read sites:
`buttonVariants`' `cva` map (`components/src/ui/button.tsx`) carries all six
variants and all four sizes; `AdvancedChartImpl` normalizes `column` to `bar`,
maps `horizontal-bar` to a real `BarChart` layout and gives `donut` its own inner
radius; `useForm({ mode })` hands `validationMode` straight to react-hook-form,
whose `isOnTouch` / `isOnAll` branches implement `onTouched` and `all`;
`toControlValue` / `matchOptionValue` (#3090) round-trip a boolean option value
with its type intact; `resolveSelectionMode` implements `'single'` as
replace-on-select with no select-all header, distinct from `'multiple'`; and
`chart` is a rendered view type with its own `case` in both `ListView` and
`ObjectView`.

Consumer-visible type effect: `z.infer` of these schemas widens accordingly.
Widening an input contract cannot break a caller that was already passing a
narrower value, but code that exhaustively switches on the inferred union — e.g.
a `switch` over `chartType` with no `default` — will want the new arms.

Refs objectui#5927 (group A of the 17 measured mirror drifts). The remaining
classes are rulings rather than edits and stay in the `KnownDrift` ledger.
