---
"@object-ui/app-shell": patch
---

Make metadata-form visibility predicates work again in the Setup/Studio admin
engine: `SchemaForm` now reads the canonical `visibleWhen` key, falling back to
the deprecated `visibleOn` alias (objectstack#6331).

ADR-0089 renamed the FormView predicate `visibleOn` → `visibleWhen`, and the
spec's normaliser REWRITES the alias rather than keeping both — a parsed
`FormView` carries `visibleWhen` and no `visibleOn` at all. All five predicate
read sites in `SchemaForm.tsx` looked at `visibleOn` only, so every spec-served
predicate read as absent and each guard short-circuited to "visible". Every
conditional field, section and tab in every metadata form rendered
unconditionally.

Measured over the bundled `@objectstack/spec@17`: `objectForm` carries 16
sub-field predicates, `viewForm` 7, `actionForm` 6, `pageForm` 4 — all spelled
`visibleWhen`, none spelled `visibleOn`. Every one of them was inert.

Fixed sites: the flat per-property path, section-level, section field-level,
the tabbed path's field probe, and `type: 'record'` row sub-fields. Spelling and
precedence mirror the runtime record-form adapter (`@object-ui/plugin-form`
`sectionFields.ts`) and the spec bridge (`@object-ui/react` `form-view.ts`),
which already read `visibleWhen ?? visibleOn` — one dialect across the repo,
canonical wins. `FormSectionSpec` / `FormFieldSpec` declare both keys, the alias
marked `@deprecated`.

**Visible behaviour change** — these predicates have never taken effect in a
shipped build, so they switch on for the first time here:

- Studio's object field list now shows only the type-relevant row sub-fields: a
  `currency` field shows Min / Max / Precision / Scale, a `text` field shows Max
  Length / Min Length, instead of all of them at once.
- Page authoring hides Data Context / Layout / Template on a `list` page and
  shows the Interface section, and the mirror for a record page. View, Action and
  Report authoring forms gain their type-conditional sections and fields.

Predicates authored with the deprecated alias keep working, including this app's
own create schemas, which set `visibleOn` directly on raw JSONSchema properties
(`view-create-body.ts`, `anchors.ts`) and never pass through the spec normaliser.

Note for the rollout: the predicates must be `data.`-scoped to evaluate against
the draft (objectstack#6254 corrected 16 bare spellings in `object.form.ts`). A
backend still serving the pre-#6254 bare spelling now yields the opposite
symptom — those sub-fields stay hidden rather than always shown — because the
admin engine's evaluator resolves an unscoped identifier to `undefined` and the
predicate goes false.
