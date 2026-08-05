---
'@object-ui/plugin-list': patch
---

Gallery covers now resolve the `coverField` value through its **file value
shape** instead of assuming the field value *is* a URL string, so an
ADR-0104-conforming `image` value renders a cover again (objectui#3317).

Since ADR-0104 D3 wave 2 the stored value of a `file`/`image`/`avatar`/
`video`/`audio` field is an opaque `sys_file` id, which the read path expands
in place into `{ id, name, size, mimeType, url }`. `ObjectGallery` read the
value twice — `hasAnyCover` tested `typeof value === 'string'`, and each card
did `item[coverField] as string` — so against a spec-correct object value the
cover area collapsed for the whole gallery, and the card underneath it built
an `<img src="[object Object]">`. The only values that ever rendered were the
inline `data:` URIs and external links ADR-0104 retired, which is why this
stayed invisible.

## What changed

- Both reads now share one `resolveCoverUrl`, so the "does anything have a
  cover?" predicate and the per-card render can no longer disagree — that
  disagreement is what collapsed the area for records that did have a cover.
- Shape handling is delegated to `readFileValues` from `@object-ui/fields`,
  the platform's existing single arbiter of file value shapes, rather than
  re-derived in the gallery. It accepts the expanded `{ url }` object, a
  legacy bare URL string (still valid during the dual-mode window), and a
  still-bare `sys_file` id — which resolves to the stable
  `/api/v1/storage/files/:id` endpoint instead of reaching `<img src>` as a
  raw opaque token. A value carrying no resolvable URL yields no cover, which
  collapses the area rather than emitting a broken `src`.
- A `multiple` file field's first entry is used as the cover.

The sibling paths that thread `coverField`/`imageField` around
(`ListView`, `app-shell/ObjectView`, `plugin-view/ObjectView`) pass the field
**name**, not the value, and needed no change.
