---
'@object-ui/cli': patch
---

`objectui serve` and `objectui build` now locate the project the way `dev` does, instead of looking only in the current directory.

For a project with an app config and a `pages/` directory beside it, the three
commands answered one invocation two different ways. `dev` anchored on the
schema argument — `dirname(<schema>)` is the project root, `pages/` beside it
means file-system routing, the named file is the app config. `serve` and `build`
looked for a `pages/` directory in the current working directory and nowhere
else, so from any directory above the project they fell through to single-schema
mode and handed the app config to the renderer as if it were a page.

Measured on the reported fixture (`<root>/app.json` + `<root>/pages/index.json`,
invoked from the directory above): `dev` reported the project and one route,
`serve` reported `Loading schema: <root>/app.json`, and `build` did the same and
**exited 0** — the emitted bundle embedded the app config as the page schema and
contained no page from `pages/` at all. A wrong artifact, produced silently.

The detection now lives in one helper the three commands share
(`utils/project-source.ts`), resolving in a fixed order: a `pages/` directory
beside the schema argument, else one under the current directory, else
single-schema mode. `serve` and `build` also pass the resolved app config to the
routed app generator, which they never did, so a routed project keeps its layout
under all three commands.

A lone schema file with no `pages/` beside it is unchanged — that is the
fallback, and it is still a supported way to run.
