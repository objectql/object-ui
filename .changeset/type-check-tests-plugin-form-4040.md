---
---

Releases nothing on purpose: `@object-ui/plugin-form` now type-checks its 40 test files
(`tsconfig.test.json` chained from `type-check`), and its `TEST_DEBT` entry is gone. Only
test sources changed; no published behaviour, and no public type, moved.

Thirteen code-tier errors, ten of them one collision. `describe.each` over the four
sectioned containers hands JSX a UNION of `ModalForm | DrawerForm | TabbedForm |
SplitForm`, and JSX resolves a union of components by INTERSECTING their props — so
`ModalFormSchema & DrawerFormSchema & …` reduced `formType` to `never` and every schema
was rejected, including the right one. The parametrised suites now name the surface they
actually exercise (`schema` plus `dataSource`) once, which is the only shape all four are
assignable to; the `formType` values they pass are pinned to a literal union instead of
`string`, so the discriminants stay checked.

The other three were each a stub or fixture that told the compiler less than the code:

- `occSave.test.tsx` stubbed `dataSource.update` with three parameters while the contract
  is `(resource, id, data, opts?: { ifMatch? })` — and the assertion under test reads the
  FOURTH argument. vitest records real arguments whatever the stub declares, so
  `mock.calls[0][3]` passed at runtime against a declared 3-tuple. Now declared, so the
  case checks the option bag it is about.
- `deriveMasterDetail.test.ts` built a field map by `.map().concat()`, where inference
  narrowed the nine plain fields to `{ type: string }` and the tenth (a relation carrying
  `reference`) was then rejected. The entry type is written out.
- `LineItemsPanel.test.tsx` had an unread `o` parameter on an `update` double (`TS6133`,
  from the repo's `noUnusedParameters`), renamed `_o`.
