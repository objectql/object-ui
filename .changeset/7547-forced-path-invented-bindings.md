---
'@object-ui/plugin-list': minor
'@object-ui/app-shell': minor
---

Stop inventing a gallery cover binding, and offer the view switcher only when it
can switch (objectui#7547).

**The object page no longer floors `gallery.imageField` at `'image'`.** It used
to supply that key for every object view, declared or not. The screen damage was
small — `ObjectGallery` collapses the cover area when no record yields a cover —
but the key fed `ListView`'s ADR-0047 capability gate, which reads
`options.gallery.imageField`, so **Gallery was offered on every object view that
whitelisted it**, with nothing behind the toggle. `galleryViewOptions` now
forwards the view's own declared block (both legacy cover spellings still
cross-fill each other, and `titleField` keeps its `'name'` display floor) and
emits no cover key when the view declared none. Same class and same route as
objectui#7029 (calendar) and objectui#7070 (gantt dates).

⚠️ A view that whitelisted `gallery` without a `gallery:` block loses the Gallery
toggle. That is the ADR-0047 rule working: it was only ever offered because this
relay answered the gate on the author's behalf.

**The visualization switcher is drawn for the resolved list, not the whitelist.**
`showViewSwitcher` was computed from the LENGTH of
`appearance.allowedVisualizations` — the whitelist BEFORE `ListView` intersects
it with the capability gate — so a view whitelisting `['grid', 'timeline']` with
no timeline block drew switcher chrome around a single Grid entry. The predicate
now lives at the one site that holds both halves. Views whose whitelisted types
all resolve are unaffected.
