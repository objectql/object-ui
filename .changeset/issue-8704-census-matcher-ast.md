---
---

Repo script and its pin test only. `scripts/census-recorder-wait-shape.mjs` gains an AST
matcher (objectui#8704): recorder identity resolved over bindings and aliases instead of
name spelling, forward windows scoped to the enclosing test body in statements, and every
occurrence classified read / write / declaration. The original regex census is kept behind
`--matcher=regex` so objectui#8690's and objectui#8703's published numbers stay
reproducible. objectui#8703's five fixtures are committed as the script's test suite, with
a sixth that must stay flagged. The header's "no count here is a corpus fact" caveat stays,
with its residuals restated. The census is still not wired into CI. No published behaviour
changes.
