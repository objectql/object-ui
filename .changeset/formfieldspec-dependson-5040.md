---
'@object-ui/app-shell': patch
---

metadata-admin: `FormFieldSpec` declares `dependsOn`, and the widget half reads
the same declaration instead of its own copy of it (objectui#5040)

`FormFieldSpec` — the authoring type for a metadata-admin form layout, the
element type of `FormSectionSpec.fields[]` — did not declare `dependsOn`.
`widgets.tsx` held a second, inline description of the same object as
`WidgetProps.fieldSpec`, and that one did, because two registered widgets read
it as their primary configuration: `field-selector` resolves
`dependsOn || reference || 'objectName'` to decide whose field catalog to
offer, and `dynamic-config` uses it to pick a sub-schema out of
`WidgetContext.dynamicSchemas`. One value travelling down one channel,
described twice, disagreeing on the one key that decides what those widgets
show — so

```ts
{ field: 'fields', widget: 'field-selector', dependsOn: 'objectName' }
```

the only configuration that makes `field-selector` work, was a `TS2353` for
anyone who typed their spec. It survived because in-repo specs reach the form
through `as any` / loose types, so the authoring type was never asked.

No runtime behaviour changes: `MetadataField` already handed `dependsOn`
through and both widgets already read it. What changes is the type face — it
now admits what the runtime has always accepted. The two descriptions are one
declaration, extracted to a leaf module
(`views/metadata-admin/form-spec.ts`) that both halves import, because
`SchemaForm.tsx` imports `./widgets.js` and a back-edge would close a cycle.
`SchemaForm.tsx` re-exports `FormFieldSpec` and `VisibilityPredicate`, so every
existing importer is unaffected.

`dependsOn` is `string | string[]` here, deliberately **not**
`@object-ui/types`' wider canonical `DependsOnInput`, which also admits
`{ field, param }` objects: both readers index `[0]` and use the result as a
field name, so the wider shape would be a type that lies. Converging the two is
its own decision, pinned as a refusal rather than taken silently.
