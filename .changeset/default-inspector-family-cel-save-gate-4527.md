---
'@object-ui/app-shell': patch
---

The default-inspector family and its panel hosts gate Save on CEL errors — a hook guard, an action predicate or a validation rule that does not parse no longer saves

#4306 gave the SCOPED inspectors a way to say "what I am showing is not saveable" (`MetadataInspectorProps.onBlockingIssuesChange`), and #4527's first half wired the shared CEL editors to it. That left the other half of the console still publishing malformed expressions, for a structural reason rather than an oversight: there are TWO inspector registries, and only one of them had the channel. `MetadataDefaultInspectorProps` — the contract every "no selection" inspector is rendered through — had no such member, so the hook guard, an action's `visible` / `disabled` predicates and a view's conditional-formatting rules on the home panel rendered their inline parse errors while Save stayed writable, and no host could pass a callback that did not exist.

`MetadataDefaultInspectorProps` now carries the same optional `onBlockingIssuesChange`. `HookDefaultInspector` reports its guard; `ActionDefaultInspector` aggregates its two predicate editors through a per-site map, because two editors lint independently and a shared counter would hand back a writable Save the moment one of two broken predicates was fixed; the view home panel already aggregated and now has a contract to report through.

The hosts that own the buttons hold and expire those counts. The metadata editor gates its no-selection branch as well as its scoped one, stamping each so neither reads the other's verdict. Studio's design pillar gates its rail at last — that was an unfinished edge of #4306 rather than new ground, since the same malformed-CEL publish was reachable there with the gate inert, including for the field inspector. The Data pillar gains a second count for its panel family: the validations, actions and settings panels write through the object draft and own no Save, so their faults have to reach the pillar's button, and the count is stamped with the panel tab because only one panel is mounted at a time and a tab the author has left can never retract its verdict. The hooks panel is the one panel that writes on its own (`client.save('hook', …)`), so it gates its own per-hook Save.

Every count is DERIVED from what it describes rather than repaired by a reset effect, and pruned by what still exists: a deleted validation rule or action drops out of the total immediately, so a fault can never wedge Save shut with no editor left on screen to fix it in. A faulty rule the author merely navigates away from stays counted, because it is still in the document and saving would still publish it.

Also wired: the object validations panel, a sixth `ConditionBuilder` consumer that the original report did not list. Still deferred by ruling: `widgets.tsx`'s condition widget, a `SchemaForm` widget needing widget-context plumbing.
