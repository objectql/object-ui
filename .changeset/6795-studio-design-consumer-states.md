---
'@object-ui/app-shell': patch
---

Studio design: say what is true when the metadata designer registries are
unpopulated (objectui#6795 part C).

The three registries (`preview-registry`, `inspector-registry`,
`default-inspector-registry`) are plain `Map`s filled by a module-scope side
effect, and every studio-design consumer reads them **during render with no
subscription**. A consumer that reads an empty registry therefore gets
`undefined` and never recovers — measured: registering afterwards leaves the
consumer in its fallback forever. Four consumer states lied about that, and
one was silent:

- **Data pillar field rail** — the guard was
  `fieldSel && (fieldSel.kind === 'group' || inspector)`, so selecting a
  **field** with no inspector registered dropped the whole rail: clicking a
  field did literally nothing while the designer above it went on saying
  "click a field to edit its properties". A selection now always opens its
  rail, and the rail names the missing inspector.
- **Interfaces canvas** — "{type} shows a read-only preview for now; design
  support is in progress" was false twice: the branch renders no preview at
  all, and page design support exists. It is split by
  `listMetadataPreviewTypes()` into the two causes that are actually
  distinguishable — this type has no designer, or none are registered at all.
- **Interfaces rail** — no longer tells the author to click a canvas that is
  not rendered.
- **Automations pillar** — the canvas chip and the rail both said "click a
  node" while the canvas was a raw JSON dump.
- **`ObjectActionsPanel`** — rendered only the action's own label, which read
  as "this action has no properties"; the label now carries the reason there
  is no editor under it.

⛔ None of these messages promises recovery ("loading…", "try again", a
spinner): that would replace one false statement with another. Making the
registries observable so recovery is real is part A of #6795, which the ruling
deferred. `ObjectSettingsPanel` and `ObjectHooksPanel` are deliberately
untouched — the measurement found both already correct.
