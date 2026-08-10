---
'@object-ui/create-plugin': patch
'@object-ui/cli': patch
---

Move the generator templates' dependency ranges onto the repo's current ones

The dependabot wave of 2026-08-10 bumped `lucide-react` to `1.29.0` and `vite`
to `8.2.1` in this repo's own manifests, but the ranges hard-coded in the
scaffold generators do not move with it — dependabot does not know the
templates exist. A project scaffolded by `objectui init` / `objectui dev` or by
`create-plugin` therefore declared a range the repo itself had already moved
past.

Three ranges are re-anchored: `lucide-react` `^1.28.0` → `^1.29.0` in the routed
app generator, and `vite` `^8.2.0` → `^8.2.1` in both the shared CLI scaffold
devDependencies and the create-plugin template.
