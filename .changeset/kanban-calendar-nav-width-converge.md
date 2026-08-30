---
---

`ObjectKanban` and `ObjectCalendar` internal cleanup, measured as a zero-pixel
change — the convergence of the two renderers #6305 left behind.

Each carried the house default `min(960px, 60vw)` at **two** sites: the
`navConfig` default (`{ mode: 'drawer', width: 'min(960px, 60vw)' }`) and a
render-site `width={(navigation.width as any) ?? 'min(960px, 60vw)'}`. Both are
gone. `width` is spec-deprecated (`@deprecated [#2578 -> size]`) and
`resolveOverlayWidth` gives an explicit `width` priority OVER `size`, so
spelling it kept the deprecated branch load-bearing on the path most boards and
calendars take. With both omitted, `resolveOverlayWidth` returns `undefined` and
`RecordDetailDrawer`'s own `width` default supplies the identical
`min(960px, 60vw)`.

The resolved overlay width is therefore unchanged on every viewport, for both a
board/calendar that declares no `navigation` and one that authors
`navigation.width` — each is now pinned by a test. The three renderers agree
again.

No published behaviour changes.
