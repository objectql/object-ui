---
---

Build tooling only — no package source changes, so nothing is released here.

`packages/*` built by plain `tsc` are `composite`, and TypeScript resolves their
`tsconfig.tsbuildinfo` next to `tsconfig.json` rather than inside the `dist/` it
describes. Once those two disagree, `tsc` believes the record: it emits nothing,
repairs nothing and exits 0, and the damage surfaces as ordinary-looking type
errors in whichever packages import the truncated artifact (objectui#6703).

Each such build now ends by asserting that every file `tsc` says it emits is on
disk, and each `clean` takes the buildinfo with the `dist/` it describes.
