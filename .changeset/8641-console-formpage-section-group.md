---
'@object-ui/plugin-form': minor
'@object-ui/console': patch
---

Render a form section that REFERENCES a field group on the console's form page,
and publish the resolver that does it (objectui#8641).

`@objectstack/spec` 17.3.0 lets a `form.sections[]` entry declare its members
either way — enumerate `fields`, or point `group` at one of the object's declared
`fieldGroups` (objectstack#13855, ADR-0085 §5). `apps/console`'s `FormPage` has
its own section builder, on none of `@object-ui/plugin-form`'s code path, and it
read `sec.fields ?? []` and `sec.label` — neither of which a `{ group }` section
carries. Measured in the DOM on both routes before the fix: the `<section>` was
emitted with its border and padding and then stood **empty** — no heading, no
inputs, no diagnostic — so a submitter saw a blank card where the group's fields
belong. The same silent-drop class objectui#7051 closed on the `plugin-form`
chain, at the third consumer.

Newly importable from `@object-ui/plugin-form` — one function and the options
type its signature requires, nothing else:

```typescript
import {
  resolveSectionGroupReferences,
  type ResolveSectionGroupsOptions,
} from '@object-ui/plugin-form';
```

- `resolveSectionGroupReferences(sections, { objectName, formType, objectDef })`
  — replace every `{ group: 'x' }` section with the section that group declares
  (label, members, description, collapse state), leaving everything else
  untouched. With no reference in the list it returns its input **by identity**,
  so it cannot perturb an existing form and is safe inside a `useMemo`. An
  unresolvable reference yields an empty section, never a dropped one, and is
  reported once naming the object and the key.

`hasSectionGroupReference`, `resetSectionGroupReports`, `GROUP_OWNED_SECTION_KEYS`
and `SECTION_LAYOUT_KEYS` stay module-private, pinned as the withheld set.

⛔ No assembly rule is re-implemented on the console side: declared order, the
empty-group drop, the ungrouped trailing bucket and the collapse / `visibleWhen`
passthrough all reach it from `deriveFieldGroupLayout` through this package's one
adapter — the same code path `ObjectForm` resolves through — which is why the
resolver is exported rather than the derivation being read a second time.

`ObjectSchemaPayload` in the console now carries `fieldGroups`, and its internal
`/meta/object/:name` loader copies the key: that rebuild is key by key, so an
uncopied key is gone before the builder can see it.

No behaviour change for any form that does not author `group`.
