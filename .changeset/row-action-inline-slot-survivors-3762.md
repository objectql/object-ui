---
"@object-ui/plugin-grid": patch
---

Grid row actions: the inline button budget is now spent on the primaries that actually render

`RowActionMenu` allocated its inline slots on the **declared** row actions, before
any `visible` predicate ran:

```ts
const primaryDefs = gatedActionDefs.filter(d => d.variant === 'primary');
const inlineDefs = primaryDefs.slice(0, Math.max(0, maxInlineActions));
```

So on a row where the *leading* `variant: 'primary'` action was suppressed by its
own `visible`, that action still held the slot — `RowActionInlineButton` returned
`null` into it — while the next primary, the one that *did* survive the row's
predicates, had already been sliced into the overflow list. The row then rendered
**no inline button and a "⋮" hiding its main CTA**, even though exactly one primary
was visible and `maxInlineActions` (default 1) allowed exactly one inline button.

Slot allocation now happens inside `planRowActionMenu`, after visibility, so the
budget is only ever spent on a primary that renders. `maxInlineActions` is
unchanged in meaning and default — it is a width budget for real buttons, and
counting an invisible action against it protected no layout.

Behaviour change surface, deliberately narrow:

- a row with 2 or more primaries where a *leading* one is suppressed for that row —
  the surviving primary moves from the "⋮" menu to an inline button, and the "⋮"
  disappears if nothing else is left to fold;
- unchanged: how many primaries may go inline, the menu order (folded primaries
  above secondaries), which items render at all, the ADR-0066 D4 capability gate
  (still applied once to the declared set, upstream of this decision), and the
  #3562 empty-menu guard — a row with nothing renderable still grows no trigger.

Rows whose primaries are all ungated (the `sys_environment` Open + Upgrade Plan
shape that motivated `maxInlineActions`) are bit-for-bit unaffected: declared order
and surviving order coincide.
