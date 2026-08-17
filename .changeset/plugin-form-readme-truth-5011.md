---
'@object-ui/plugin-form': patch
---

`packages/plugin-form/README.md`: three assertions about this package's export
surface were false, and the export names are now taken from the built
`dist/index.d.ts` (TS compiler API `checker.getExportsOfModule`) with every
TypeScript block compiled against those same declarations under `strict`.

- **`formComponents`** — fiction, and not a name that could be corrected: there
  is no aggregate component map on the surface at all, so the "Manual
  Registration" section described a mechanism that does not exist. Copying it got
  `undefined` and threw on `Object.entries(undefined)`. It is replaced by what
  actually happens: registration is a side effect of importing the entry, whose
  six `ComponentRegistry.register(...)` calls claim
  `plugin-form:object-form`, `view:form`, `plugin-form:embeddable-form`,
  `plugin-form:form-analytics`, `plugin-form:object-master-detail-form` and
  `record:line_items` — the two `skipFallback: true` calls being why bare `form`
  and bare `line_items` are *not* taken over. The section also lists the real
  export surface, and shows the thing the old snippet was reaching for: putting
  an exported component on a schema type of your own, with the caveat that the
  package's own registered renderers are internal wrappers that first resolve
  `dataSource` from `SchemaRendererContext`.
- **`FormSchema` / `FormField`** — real types imported from the wrong package.
  Both are protocol types declared in `@object-ui/types` (`src/form.ts`); this
  package imports them and does not re-export them, so the documented import was
  a `TS2305` pair. Only the import path changed — no re-export was added to make
  the old path true, since widening a package's public surface is a contract
  change and not a documentation fix. The section now also points at the form
  types that *are* on this entry (`TabbedFormSchema`, `WizardFormSchema`,
  `ModalFormSchema`, …).
- **`isRuntimeDefault` "(re-exported here)"** — the create-defaults section
  claimed the predicate is re-exported by this package. It is re-exported by
  `src/schemaDefaults.ts` for internal use only, never from the entry, and the
  package publishes just the `"."` export — so `import { isRuntimeDefault } from
  '@object-ui/plugin-form'` is another `TS2305`. The parenthetical now says where
  the re-export actually lives.

No code, types or runtime behaviour change — the diff is one README plus this
changeset. It declares a patch because `README.md` is in the package's published
`files`, so the correction reaches npm with the next release.
