---
---

Comment-only fix: eleven test headers across `@object-ui/app-shell` and
`@object-ui/core` still described a type-checking arrangement that no longer
exists. Two distinct stale claims, both now corrected:

1. **"this package's tests are compiled by nothing."** Both packages graduated
   in objectui#4040; each `type-check` script is now
   `tsc --noEmit && tsc -p tsconfig.test.json`, and `TEST_DEBT` in
   `scripts/check-type-check-coverage.mjs` is literally `{}`.
2. **Present-tense citations of `tsconfig.typetests.json`,** of which zero exist
   repo-wide (objectui#4291 retired the last of them). Several headers told the
   reader that a listing in such a project is what makes their assertions
   load-bearing — a file the reader cannot find.

Both matter beyond tidiness because several of these headers *prescribe*: one
said a `@ts-expect-error` here "would be read by no compiler", another that "a
new type-assertion test file is unchecked until it is added to that include
list". Both instruct the next author away from assertions that are in fact
checked, and away from the config that checks them. That is the same shape
objectui#6426 was filed and fixed for in `@object-ui/plugin-dashboard`.

Where a header is now positive ("this file IS compiled"), the claim was
confirmed for **that file**, not inferred from the package-level coverage
reading: `tsc -p tsconfig.test.json --listFiles` lists all 8 edited app-shell
files (of 4455) and all 4 edited core files (of 634), and both projects exit 0.
Surviving mentions of `TEST_DEBT` and `tsconfig.typetests.json` in these files
are deliberate, and are now past-tense — they record why the header used to say
otherwise.

No behaviour change, no public surface change, no assertion or directive
touched.
