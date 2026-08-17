---
'@object-ui/app-shell': patch
---

The Studio Interfaces rail opens `action` nav entries instead of greying them out.

The Interfaces pillar's rail is the current package's App `navigation` tree, and
each leaf opens the design surface of whatever it binds to. `resolveSurface`
bound five shapes — `page`, `object`, `dashboard`, `report`, `view` — and not
`action`, so an action entry rendered `disabled`: visible in the designer, 40%
opacity, inert on click. The same entry works in the shipped product, where
`NavigationRenderer` renders it and `useNavActionDispatch` resolves and executes
it (framework#4509), and `action` has carried both a registered preview
(`ActionPreview`) and a registered default inspector (`ActionDefaultInspector`)
the whole time. Only the binding was missing, so the one nav variant naming an
authorable metadata item was the one variant the designer could not author.

Clicking such an entry now opens the action on the standard surface — the
`ActionPreview` canvas plus the action's inspector — and draft-saves through the
same generic path as the pillar's other leaves.

Scope, stated because the neighbours are deliberately untouched: `url`,
`separator` and `component` leaves stay unresolvable, and are not a gap — an
external link, a divider, and a first-party UI shipped in code have no metadata
item to design. Object-scoped actions keep their existing home, the object's
Actions tab: `ActionNavItemSchema` is strict `{ actionName, params? }` with no
`objectName`, so a nav action is a global action by construction and this path
cannot reach an object-scoped one.

`actionDef.actionName` is read as the only spelling. The spec answers `action` /
`name` / `args` / `input` there with a named rejection rather than accepting
them (objectstack#4001, measured on spec 17.0.0-rc.6), and a tolerant read here
would re-open exactly what that closed: an entry that dispatches an action its
author did not declare.
