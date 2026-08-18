---
'@object-ui/cli': patch
---

`objectui check` reads `.json` as JSONC, so a `tsconfig.json` no longer fails the run.

`check` globbed every `**/*.{json,yaml,yml}` and handed each `.json` straight to
`JSON.parse`. A throw there is the only thing that increments the error count, and
a non-zero error count is the only thing that calls `process.exit(1)` — so a `//`
comment or a trailing comma, which is how TypeScript documents `tsconfig.json`,
was reported as a malformed file and **failed the command**. Every TypeScript
project hit this: `objectui check` exited 1 for anyone who ran it, and at this
repository's own root it reported 64 errors, all of them `tsconfig*.json`
(objectui#5237).

`.json` on disk means JSONC in practice — `tsconfig.json`, `.eslintrc.json`,
`devcontainer.json` and VS Code's own settings are all written that way — so the
file is now read with `jsonc-parser`, which permits comments and trailing commas.
No new package enters what users install: `jsonc-parser` is already a runtime
dependency of `@object-ui/app-shell`, it is already at the version the lockfile
resolves, and it declares no dependencies of its own.

The reader is a real JSONC parser and **not** a comment-stripping regex, because
a `//` inside a string value — a URL, say — is not a comment, and a stripper that
cannot tell the difference corrupts valid files instead of reading them.

Genuinely malformed JSON still errors and still exits 1. That needed saying in
code as well as in tests: `jsonc-parser`'s reader is error-tolerant and returns a
best-effort value rather than throwing, so the command consults its reported-error
array instead of inferring success from the absence of a throw. Error output now
names the reason and the line and column.

The unknown-schema-type warning arm is deliberately untouched: it still warns, and
it still does not affect the exit code. Files that previously died at the parse
step now reach it, so a JSONC file carrying an unrecognised root `type` warns
where it used to error — the verdict and the exit-code neutrality are unchanged.
