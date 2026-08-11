---
---

Retire the narrow `tsconfig.typetests.json` projects in the six packages that have graduated out of `TEST_DEBT`

`tsconfig.typetests.json` is a rescue hatch (objectui#3181): a package whose test tree was still in `scripts/check-type-check-coverage.mjs`'s `TEST_DEBT` could compile the one file whose whole value is compile-time assertions — `Assert< Equal< Local, Spec > >` is a `tsc` error or it is nothing — instead of waiting for its whole backlog to compile. As objectui#4040's tranches landed full `tsconfig.test.json` projects, that hatch became redundant in the packages that graduated: the full project already compiles the same file, so the repo carried two spellings of what gets checked plus one extra `tsc` per `type-check` run.

Retired in `@object-ui/auth`, `@object-ui/plugin-chatbot`, `@object-ui/plugin-detail`, `@object-ui/plugin-form`, `@object-ui/plugin-grid` and `@object-ui/plugin-list`, each with its `type-check` chain entry. For every one, `tsc -p tsconfig.test.json --listFiles` was checked to contain the exact file the narrow project named, and a provably-false `Assert` appended to that file turned the FULL project red (TS2344, exit 2) — so the coverage moved rather than vanished. The four packages still in `TEST_DEBT` that have a narrow project (`app-shell`, `components`, `core`, `react`) keep theirs untouched.

`scripts/check-type-check-coverage.mjs` now makes this a ratchet rather than a one-time sweep: a `tsconfig.typetests.json` on a package whose full test project already compiles everything is reported as redundant, so the seventh cannot reappear. Section 5½ had no test coverage at all before this change — the gate keeping the rescue hatch honest was itself unchecked — so it gains a fixture suite plus a real-repository pin on the six retirements.

No published behaviour changes: only `type-check` scripts, checking-only tsconfig projects, test-file comments and a CI gate.
