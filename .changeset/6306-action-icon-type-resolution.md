---
'@object-ui/components': patch
---

An `action:icon` hosted by an `action:bar` now reaches its handler. It forwarded the
COMPONENT id as the action type, so the click resolved nothing at all — no error, no
toast, a button that silently did nothing (objectui#6306, the objectstack#2169 "Mark Done
does nothing" shape).

`action:bar` does not route members through `SchemaRenderer`. It pulls each member's
renderer off the registry and RENAMES the declared type as it spreads it onto the child:
`type` becomes the component id (`'action:icon'`) and the real declaration moves to
`actionType`. `action:button` has always resolved that pair when it forwards
(`schema.actionType || schema.type`); `action:icon` read `schema.type` alone and dropped
`actionType` entirely. `ActionRunner.execute` resolves its handler from
`action.type || action.actionType || action.name`, and `'action:icon'` binds no registered
handler and no builtin — for a declaration carrying `target` rather than `endpoint` it does
not reach the legacy `navigate`/`api` fallback either, so it fell through to
`executeActionSchema` and the authored action never ran.

**The bug was a function of the layout, not the declaration.** One authored action executed
or did nothing depending on which `component` the host picked for it — the same asymmetry
objectui#5493 fixed on this renderer for `onSuccess`, one key over.

`check:action-forward-parity` could not have caught this and its green run was never
evidence: `type` **is** in the forward whitelist, and that gate diffs key PRESENCE against
the owed set. This is a wrong-VALUE defect behind a present key, a class the gate has no
opinion on by construction. The existing icon coverage could not catch it either — it
rendered `action:icon` bar members three times and asserted only `visible`/`enabled`, never
that a click reached a handler, which is exactly how this shipped.

Pinned by `action-bar-member-type-resolution.test.tsx`, which executes clicks rather than
inspecting props. Every row that reads the icon member's zero renders a sibling
`action:button` member of the SAME declaration in the SAME bar and reads its one first, so
a zero cannot be "the harness never executed anything". One row registers a trap handler
keyed on the component id, making the unfixed behaviour a positive artefact (the trap
fires) rather than only a missing call. A standalone row stays green in both worlds on
purpose: it refuses a "fix" written as `schema.actionType` alone, which would trade this
defect for its mirror image on the surface where `type` IS the action type.

Scope is this one renderer. `type: schema` appears in exactly two files under
`renderers/action/` — `action-button.tsx` (already correct) and `action-icon.tsx`;
`action:group` and `action:menu` compose their members differently and are untouched.
