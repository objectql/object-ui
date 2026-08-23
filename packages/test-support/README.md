# @object-ui/test-support

Internal test-support modules shared between packages' test suites.

**This package is `private: true` and is never published.** It exists so that
two test suites in two different packages can share one implementation of
something they both need, without that shared thing becoming public API of a
released package.

## Why it exists at all

`packages/fields` and `packages/app-shell` each run a DOM-leak gate, and both
needed the same "is this attribute one HTML actually defines" judge. Neither
package can import the other's test file, so the judge was copied — and the two
copies had already drifted apart by the time objectui#4434 was filed.

The three constraints that ruled out every other home:

- both `packages/fields` and `packages/app-shell` must be able to reach it;
- it must **not** become published runtime API surface (which a `./test-support`
  subpath export on a released package would be — an entry in a published
  `exports` map is public API whatever it is named);
- no unpublished deep-subpath imports. objectui#4325 ruled that shape out after
  `@object-ui/fields/widgets/MarkdownContent` — a specifier only this repo's
  vitest alias could resolve, `TS2882` for `tsc`, and unresolvable for anyone
  outside the repo. A package's surface is its index, including this one.

A private workspace package satisfies all three at once, and costs one
`devDependency` line in each consumer.

## What may live here

Test *infrastructure* that more than one package's tests need: something both
suites must agree on, where two copies drifting apart is the real risk.

Not: fixtures for one package's own tests (those belong next to them, e.g.
`packages/components/src/__tests__/test-utils.tsx`), and not anything shipped
code imports — nothing in `src/` of a released package may import this.

## Contents

- `src/dom-leak-judge.ts` — the DOM-leak attribute judge: `isKnownAttribute`,
  `findLeaks`, `leakReport`, the happy-dom IDL gap table, the SVG presentation
  list and the open attribute families. Consumed by
  `packages/fields/src/__tests__/widget-dom-leak-e2e.test.tsx` and
  `packages/app-shell/src/__tests__/widget-dom-leak-sweep.test.tsx`.
- `src/__tests__/dom-leak-judge.test.tsx` — the calibration fixtures that prove
  the judge, once, for both gates.
- `src/spec-tombstones.ts` — the ADR-0087 D2 tombstone judge:
  `authorableShapeKeys`, `listedShapeKeys`, `tombstonedShapeKeys`,
  `isShapeKeyTombstoned`, `tombstoneEvidence`, `shapeMemberTypeName`,
  `resolvePropsShape`. Answers "does `@objectstack/spec` still ACCEPT this key,
  or does it list a tombstone that rejects it by name?" — the question raw
  `Object.keys(schema.shape)` cannot answer, because a retired key stays in the
  shape (objectui#3809). Consumed by
  `apps/console/src/__tests__/registry-inputs-spec-parity.test.ts` (both parity
  directions), `packages/layout/src/__tests__/page-header-authorable-keys.test.tsx`,
  `packages/plugin-detail/src/__tests__/recordDetailsInputs.spec-parity.test.ts`
  and `packages/app-shell/src/views/metadata-admin/previews/__tests__/block-config.test.ts`
  (the last two converged off local structural-only copies by objectui#4947).
  No copy of the judgement is left in-tree: gates import this module, they do
  not write the criterion out again.
- `src/__tests__/spec-tombstones.test.ts` — the calibration for that judge: one
  synthetic fixture per recognition channel (so neither can quietly stop
  working), plus a cross-check of the structural verdict against what the
  installed contract's own `safeParse` actually rejects.

## Conventions

- Consumers add `"@object-ui/test-support": "workspace:*"` to
  **`devDependencies`** — never `dependencies`, since no consumer ships it.
- Import the package root (`@object-ui/test-support`), never a deep path.
- There is no build: consumers resolve the TypeScript source through the
  `exports` map. `pnpm --filter @object-ui/test-support type-check` reads both
  the modules and their tests in one program.
