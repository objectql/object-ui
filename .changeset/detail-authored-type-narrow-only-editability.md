---
'@object-ui/plugin-detail': patch
---

Behavior change — **an authored display `type` can NARROW inline editability, but never WIDEN it** (objectui#3355).

Both detail-surface editability gates (`HeaderHighlight`, the `record:highlights` strip; `DetailSection`, the details body) used to resolve ONE effective type with display precedence — `viewFieldType || objectFieldType`. An authored non-computed `type` therefore ERASED the object's `formula` / `summary` / `rollup` / `auto_number` declaration from the gate's view, and a machine-owned column became inline-editable.

The gate now reads the two types separately and takes their UNION: a field is non-editable if the authored entry type **or** the object field's type is computed. Renderer/editor selection keeps the old precedence, so nothing about the display changes — only who may write.

What flips:

- `{ name: 'supply_share', type: 'number' }` authored over an object field declared `rollup` (or `formula` / `summary` / `auto_number`) — a display override written to fix formatting — no longer offers a pencil / double-click editor. This is the shipped configuration behind objectstack-ai/objectstack#5077: a hook-maintained rollup was overwritten by hand from the header strip and stayed corrupted until an unrelated child-row touch re-fired it (downstream yinlianghui/hotcrm-heimao#61).
- Narrowing is unchanged: an authored `type: 'formula'` still locks a plain object column.
- Fields with no authored computed type over a plain object column stay editable, and the entry-level `readonly` declaration from objectui#3356 is still honored.

The object schema is authoritative about what is machine-computed; a presentation override has no business granting write access. The rule now lives in ONE shared helper, `isComputedFieldType` in `fieldEnrichment.ts` — beside `enrichDetailField`, the module both hosts already share — with the computed-type set moved there too (still re-exported as `TEXTUAL_REF_FALLBACK_TYPES`), so the strip and the body cannot drift apart again.
