---
'@object-ui/app-shell': patch
---

De-developerize the metadata-admin property form now that Studio's 「界面」 panel
grafts it in front of an AI-build maker (objectui#8218).

`SchemaForm` + `widgets.tsx` were written for an administrator editing metadata.
Studio's interface panel renders the very same form for someone who has never
seen a JSON Schema, so four developer habits landed inside an otherwise fully
Chinese surface. Same cause, one pass:

- **Machine-name tooltip.** The `title="Machine name"` on the identifier chip
  went through the engine string table. Note the chip's own predicate degrades
  under localization: it shows when the visible label does not spell the machine
  name, which a translated label never does — so in a Chinese panel it renders
  for *every* field. Reported, not changed here; whether a maker should see the
  identifier at all is a product call, not a rendering one.

- **Master-detail column headers.** A column whose item schema carries no
  `title` printed the raw JSON Schema key (`actionUrl`, `actionType`) as if it
  were a column name — in *every* locale, English included. It now humanises the
  key, the same convention this tree already applies wherever a title is absent
  (`json-schema-to-fields.ts`'s `prop.title || humanizeKey`, and `SchemaForm`'s
  own grid repeater: `s.label || prettify(s.field)`). `title` is an OPTIONAL
  annotation, so its absence is not off-spec metadata and the renderer has to
  render something; this is not a lenient contract fallback. The LOCALIZED
  column name needs an upstream channel that does not exist yet — filed there.

- **Numeric fields.** Both numeric renderers (`SchemaForm`'s field control and
  the master-detail cell) now gray the schema's `default` in as a placeholder,
  so an empty box reads "using the default" instead of "unknown", and forward
  `minimum` / `maximum` / `multipleOf` onto the control. Previously only
  `fieldSpec.min` / `.max` were read — which a spec-derived authoring form never
  declares — so a panel accepted a negative column count its own contract had
  already ruled out. The default stays a placeholder, never a written value, so
  "left on the default" remains distinguishable from "pinned to today's default"
  in the saved metadata.

- **Untranslated strings.** A full sweep of both files: 45 user-visible literals
  (aria-labels, placeholders, empty-state prose, segmented-control labels,
  secret-field copy, the code editor's chrome) now resolve through the engine
  table in `en` and `zh`.
