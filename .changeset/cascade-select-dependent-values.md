---
'@object-ui/components': patch
---

fix(form): thread live `dependentValues` to cascading option fields (#2284/#1583)

The form renderer only injected the live form record into data-source widgets
(`lookup`/`master_detail`/… — the `DATA_SOURCE_FIELD_TYPES` set). Registered
option widgets (`field:select`/`field:radio`/`field:multiselect`) that carry
per-option `visibleWhen` + `dependsOn` cascading were **excluded**, so
`stripRegisteredFieldProps` dropped `dependentValues` before it reached
`SelectField`. With no live record and no `formValues` context fallback, a
cascading `select` never saw its controlling field: in a create form the
dependent field stayed permanently gated on the "Select the parent first" hint
even after the parent was chosen (reproduced on the showcase `showcase_cascade`
B3 fixture — country → province never unlocked).

Option field types now receive `dependentValues` too, so the widget's
`dependsOn` gate lifts and its `visibleWhen` set re-filters live as the parent
changes — the same channel the lookup fix (#2215/#2216) already used. Regression
guard added in `form-dependent-values.test.tsx` (drives the registered
`field:select` path, not just the builtin `case 'select'` fallback the prior
cascading-select test covered).
