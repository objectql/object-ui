---
'@object-ui/plugin-detail': patch
---

`record:quick_actions` reads the toolbar's accessible name under the spelling the ARIA contract accepts, and stops advertising an action fallback it never had.

Two producer-side defects in the same component (objectui#4663), found while
objectstack#8744 measured this renderer's read points.

**The `aria` read point was dead in both directions.** The toolbar read
`schema.aria?.label` and nothing else — the ONE spelling `@objectstack/spec`'s
`AriaPropsSchema` refuses. On that closed shape `label` is an ALIAS ENTRY: a
rename prescription pointing at `ariaLabel`, there to produce a better rejection
message, never accepted (measured: `safeParse({ label })` returns
`unrecognized_keys` naming `label`, while `safeParse({ ariaLabel })` passes). So
a spec-valid `aria: { ariaLabel: 'Account actions' }` reached the renderer and
was read by nothing — the built-in "Quick actions" default won every time — and
the spelling that did work was one no author can write without the contract
rejecting the document. `SchemaRenderer`'s generic ARIA channel was no escape
hatch either: it reads the FLAT `schema.ariaLabel` and injects `aria-label` as a
component prop, which this renderer drops along with every other non-designer
prop.

The read is now `(aria.ariaLabel ?? aria.label) || 'Quick actions'`. The legacy
leg is back-compat only, for documents stored before the contract closed;
canonical wins when both are present. Both halves follow how the repo already
handles this key: `normalizeListViewSchema`'s aria fold copies the legacy key
across only when the canonical one is `undefined` (so a declared `ariaLabel: ''`
shadows a stale `label`), and `ListView`'s own read point treats an empty string
as no accessible name at all — which here resolves to the built-in default,
since `role="toolbar"` needs a name.

**The `actionNames` description promised a fallback that exists on no path.** It
read "(else every action declared for the object at this location)". Measured:
with no `actionNames` and no host-supplied `actions`, `namesToResolve` is empty,
`needsLookup` is false, the object metadata is never queried, and the bar renders
its dashed placeholder. The registry `inputs` are published — they are serialized
into `sdui.manifest.json` and the JSX authoring types, and Studio teaches authors
from them — so the promise reached tooling; objectstack#8744's dispatch prompt
quoted it verbatim as a declared input. Per the triage ruling the sentence is
what changes: implementing the fallback would be a behaviour expansion and needs
its own card. No runtime behaviour changes with it, and a regression test now
drives a LOADED metadata provider to prove the object's declared actions really
are not pulled in (with a control proving the same wiring delivers them the
moment a name asks).
