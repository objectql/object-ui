---
---

docs: the CI/CD pipeline page describes the bundle-size gates that actually exist

Release-nothing: rewrites `content/docs/guide/ci-cd-pipeline.md` and adds a test
under `scripts/__tests__/`; no package code changes.

Three claims on that page had drifted away from `.github/workflows/`
(objectui#3197):

- The console budget was documented as **60 KB** gzip while
  `performance-budget.yml` enforces `MAX_ENTRY_GZIP_KB=350` — off by 5.8x, and
  in the direction that matters: at 28.1 KB the entry chunk read as half a
  budget away from breaching, when it is using 8% of it. Anyone sizing a
  dependency against this page was reading a ceiling that does not exist.
- A `size-check.yml` workflow had its own section, triggers and limits table.
  No such file is in `.github/workflows/`, and `git log --all` finds none ever:
  the package size report it described has always been a step inside
  `performance-budget.yml`.
- That step's 50 / 100 / 150 KB tiers were printed under an **Enforced limits**
  heading. The step `echo`s them into the markdown report as explanatory text —
  no comparison, no `exit 1`. Nothing goes red when a package exceeds them.

The last one is the reason this is a bug rather than staleness. A documented
guardrail that is not implemented is worse than no documentation: it is trusted
in exactly the moment it fails. The tiers are now labelled advisory in the table
itself, next to the one limit that really is enforced.

Retyping 350 would have set up the next drift, so the number is pinned instead:
`scripts/__tests__/ci-cd-pipeline-doc.test.ts` reads `MAX_ENTRY_GZIP_KB` out of
the workflow, the three tiers out of the `echo` lines, and the workflow
filenames out of the page's prose, and fails when the page and the YAML
disagree — including in the direction nobody thinks to check: if the size report
ever grows a real comparison, the test fails and sends whoever added it back to
the "advisory only" wording.
