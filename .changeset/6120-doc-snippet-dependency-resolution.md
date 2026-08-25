---
---

Doc-snippet gate tooling only, no published package source changed.

`check-doc-snippet-types` compiles every covered snippet as its own module at the
repository ROOT. Workspace packages resolved there — it builds `paths` from each
package's own `exports` — but a THIRD-PARTY specifier did not: under pnpm, a
workspace package's own dependency is not hoisted to the root, so a snippet that
imports `lucide-react` failed `TS2307` even though `@object-ui/layout` and
`@object-ui/components` both declare it and any reader who installs those
packages gets it. Five correct blocks across `content/docs/layout` were red on
nothing but that, which blocked the whole group from being brought under the
gate. The snippets were right; the resolution environment was the gap.

The gate now derives `paths` for the specifiers each imported package DECLARES in
its own `dependencies`, resolved from inside that package's directory — the
environment a real consumer has. Deliberately narrow, and it fails closed:
`dependencies` only (not peers, not devDependencies), only packages a covered
document actually imports, only the bare specifier (no subpath wildcard), and a
dependency shipping no types is left unresolvable rather than approximated. The
repository's own manifests are untouched — declaring `lucide-react` at the root
to buy a snippet its coverage would change what this repo claims to need in order
to satisfy a checker.

A fourth self-control (`undeclared`) now runs on every invocation and keeps that
narrowness honest: a module importing `@floating-ui/react-dom` — installed here
as a transitive of Radix's popper, declared by no package a covered document
imports — MUST still produce `TS2307`. Widen resolution past the declarations and
that control goes green, which is the only way to notice that the gate has become
a rubber stamp no snippet can fail.
