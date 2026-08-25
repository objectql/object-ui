---
'@object-ui/core': minor
---

`ComponentMeta` at the registry is now DERIVED from the one declaration in
`@object-ui/types` instead of restating it, and `tags` / `description` reach the
registration surface (objectui#6067).

## The convergence

`packages/core/src/registry/Registry.ts` declared its own `ComponentMeta`: thirteen
keys, of which nine were restated from `@object-ui/types`' `base.ts`, four were
registry-only (`tier`, `namespace`, `skipFallback`, `labelling`), and `tags` /
`description` were **absent** — although both are declared on the canonical type and on
the `ComponentMetaSchema` zod mirror. Two of the three authorities agreed and the
registration surface did not, so those two keys were unwritable at exactly the
declaration most component registrations import. That is the same two-key delta
objectui#5893 had just closed inside `@object-ui/types`, arriving a third time on a
third declaration, and objectui#5671 had already made the identical move for the sibling
type `ComponentInput` in this very file.

It is now:

```ts
export type RegistryComponentMetaExtras = {
  tier?: 'public' | 'internal';
  namespace?: string;
  skipFallback?: boolean;
  labelling?: 'control' | 'group' | 'display';
};

export type ComponentMeta = CanonicalComponentMeta & RegistryComponentMetaExtras;
```

`RegistryComponentMetaExtras` is newly exported from `@object-ui/core`.

**What changes for a consumer: `tags` and `description` become writable on the registry's
`ComponentMeta`. Nothing narrows.** No key is removed, no key is renamed, and no key's
type changes, so no existing registration stops compiling — verified by type-checking all
37 workspace consumers of `@object-ui/core` (`pnpm --filter '...@object-ui/core'`), which
is why this is a widening rather than the contract break a rename would have been. All
four registry-only keys have live consumers, and they are still declared here.

This is `minor` under this repository's policy that its own breaking changes never declare
`major` (`scripts/check-changeset-no-major.mjs`); nothing here is breaking in any case.

## Converge rather than rename, and why the four keys did not move

The alternative dispositions were to rename the type so the name stops claiming a mirror,
or to move the four registry keys onto `@object-ui/types`' `ComponentMeta` and re-export
it outright the way objectui#5671 handled `ComponentInput`.

Renaming was rejected because it cannot be done without a break: `@object-ui/core` is
published, `ComponentMeta` is exported from it, and dropping the name would break every
external consumer — while keeping it as an alias would leave the mirror claim standing
under a second spelling, which fixes nothing.

Moving the four keys was rejected because `skipFallback` and `namespace` are registration
mechanics — they describe how the registry keys an entry, not what a component is — and
`@object-ui/types`' `ComponentMeta` is the general, plugin-facing, AI-facing type. The
extension keeps them where they are read, under their own named type, while the eleven
shared members exist in exactly one place and can no longer drift.

## Pinned by key set, not by assignability

Every member of both shapes is optional, so `extends` is mutually **true** across the
diverged pair — an assignability assertion is green on the defect and would not have
caught it. Measured on the emitted `.d.ts` of both packages, before and after:

| reading | before | after |
|---|---|---|
| `Core extends Canonical` | `true` | `true` |
| `Canonical extends Core` | `true` | `true` |
| `Exclude<keyof Canonical, keyof Core>` | `"tags" \| "description"` | `never` |
| `Exclude<keyof Core, keyof Canonical>` | the four registry keys | the four registry keys |

The new pin asserts the third row and names the fourth explicitly; the assignability pair
is kept beside it, labelled, as the control that shows what it cannot see. A source-level
assertion that the canonical members are not restated locally covers the remaining failure
mode — a member-identical copy, which every `keyof` comparison stays green on and which is
how the copy this replaces began.
