---
'@object-ui/types': patch
---

`WidgetInput.type` now uses the shared arm vocabulary `ComponentInputControlType`
instead of restating its eleven literals inline (objectui#5675).

That vocabulary has had a name since objectui#3832, and objectui#4972 converged the
last structural copy of the surrounding `ComponentInput` interface onto one
declaration. `WidgetInput` was the remaining site spelling the arms out — a third
copy of one list, with nothing tying it to the other two.

**No value a widget author may write changes.** The inline restatement was measured
member-equal to the shared declaration in both directions before it was replaced
(eleven arms each, same set, and in the same order), so this is a convergence rather
than a widening or a narrowing. `WidgetInput.type` also stays the SINGLE-kind form:
`ComponentInput.type` additionally accepts an array of arms for a union-typed key
(objectui#3832), and importing that capability here would have been a widening, so
it was deliberately left out — the same disposition objectui#4972 recorded when it
left this face alone.

What the convergence buys is that one of the two drift directions was **silent**.
`WidgetRegistry.load()` in `@object-ui/core` translates each `WidgetInput` into a
`ComponentInput` and passes `type` straight through, so an arm REMOVED from the
shared vocabulary would have broken that assignment loudly at compile time — but an
arm ADDED to it produced no error anywhere. Widget authoring would just have stayed
narrower than component registration, with nothing in the tree saying so. After this
change neither direction is expressible.

The pin is source-text, deliberately: a TS type alias erases at runtime, so a
member-identical restatement is indistinguishable from the derived type by any
assignability or runtime check. Both kinds of assertion are kept in
`__tests__/widget-input-control-vocabulary.test.ts`, and the ablation showing the
value assertions stay green on the defect while the identity pin turns red is quoted
in the PR body.

Two divergences between `WidgetInput` and `ComponentInput` are deliberately **not**
repaired here, and are now recorded in `WidgetInput`'s doc block instead of living
only in a closed card's body: the enum slot is spelled `options` on one face and
`enum` on the other (adapted at the `WidgetRegistry` seam, so nothing fails to
arrive), and `ComponentInput` carries five keys — `inputType`, `min`, `max`, `step`,
`placeholder` — that a widget manifest cannot express. Both are surface questions
about published keys and are raised on objectui#5675 rather than answered by this
change.
