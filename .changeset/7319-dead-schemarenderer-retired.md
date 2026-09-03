---
'@object-ui/components': patch
---

Delete the second, dead `SchemaRenderer` in `packages/components/src` (objectui#7319).

`packages/components/src/SchemaRenderer.tsx` was a 28-line component carrying the same
export name as the real renderer in `packages/react/src/SchemaRenderer.tsx`. Nothing
reached it: it is absent from the package barrel, no file in the repo imports it by any
form, and the package's `exports` map has no subpath that resolves to it.

**No behaviour changes.** The file was never in the runtime bundle — two markers unique to
it appear in zero `dist/` files, while controls for barrel-exported symbols appear in four
each. Its only shipped footprint was a stray types-only `dist/SchemaRenderer.d.ts` with no
runtime module behind it, reachable through no specifier; the published tarball loses that
file, and no importable surface changes in either direction. Hence a patch, not a minor.

**Why deleting beat keeping.** The copy is a trap, which is what the card's triage asked
whoever took it to settle. It evaluates no predicate at all: of the real renderer's six
visibility legs (`visibleWhen` / `visible` / `visibleOn` / `visibility` / `hidden` /
`hiddenOn`) it consults exactly one, `hidden`, and by bare truthiness rather than
evaluation — so a node declaring `hiddenOn` is never hidden, and the two enablement legs
(`disabled` / `disabledOn`) are not read at all. It then spreads `{...schema}` raw, so
`disabled` would reach the widget as an unevaluated value, which is the precise inverse of
the real renderer's contract: evaluate the predicate, strip the raw key, forward only the
verdict.
