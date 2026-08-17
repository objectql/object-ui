---
'@object-ui/create-plugin': patch
---

A scaffolded plugin's generated manifest now asks for the same `@testing-library/jest-dom` range this repo installs.

`src/templates.ts`'s `DEV_DEPENDENCIES` had fossilised one patch behind the repo
root: the template said `^7.0.0` while the root manifest had moved to `^7.0.1`.
`templates.test.ts`'s anchor rule caught it and was red on `main`.

Same defect class, same day and same dependabot wave as the `lucide-react` drift
in `@object-ui/cli`'s app generator, so both templates move together here — which
is how the previous occurrence of this incident was handled too (objectui#4098 /
PR objectui#4099 moved these same two templates in one PR). This one came from
the dev-dependencies group bump rather than the single-package bump, and it was
found only because the two ratchets live in different packages: the anchor rule
throws on its first mismatch, so nothing reports the second template until the
first is green.

The remaining seven anchored ranges in this template were swept against the same
wave and are all in sync.
