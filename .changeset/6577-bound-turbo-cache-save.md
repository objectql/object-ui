---
---

Bounds the `.turbo/cache` save on `ci.yml`'s `type-check` job so cache bookkeeping can no
longer discard a verdict the gate has already recorded (objectui#6577). CI-only; no package
source, no published contract and no runtime behaviour is touched, hence the empty
declaration.

On 2026-08-26 a pull request whose every check was green was ejected from the merge queue
with `CI_FAILURE`. All 21 real steps of its `Type Check` job succeeded — `Run type-check`
reported success at 13:31:31Z — and then `Post Turbo Cache`, the save phase of
`actions/cache@v6`, spent 13m09s inside the upload and was still there when the job's
`timeout-minutes: 20` fired at 20m02s. The job went `cancelled`, the merge queue cannot tell
`cancelled` from `failure`, and the pull request was dequeued. The bill lands on every lane:
the queue is one shared serial resource, so that is 20 minutes of head-of-line blocking, an
ejection, and a full re-run. It was transient, not structural — the same job on the same PR
head thirteen minutes earlier went green in 5m53s with a cache save of **one second**.

Same shape as the objectui#5304 `apt-get` fix already documented in `ci.yml`: an unbounded
network call whose only backstop was the job ceiling, which converts a transient fault into a
CANCELLED check — a gate that reports nothing at all. With one twist that makes it worse
here, and it is the sentence the workflow now carries: **the verdict had already been
recorded, and everything after it was bookkeeping.**

The combined `actions/cache` action declares `main: dist/restore/index.js` and
`post: dist/save/index.js`, so its save is a step the *runner* generates at job end. No
workflow syntax attaches `timeout-minutes` or `continue-on-error` to a generated post step,
which is why the step is split rather than annotated — the route `actions/cache`'s own
`save-always` deprecation text points at:

- `actions/cache/restore@v6` keeps the original position, path, key and restore-keys.
- `actions/cache/save@v6` runs last, after the checking steps, which is exactly where the
  post phase already ran — with `timeout-minutes: 5` (300x the measured healthy save, and
  ~8 minutes clear of the job ceiling from the slowest verdict path on record) and
  `continue-on-error: true`, so a cache that fails to upload costs the next run some time
  instead of speaking for the code under test.

Raising `timeout-minutes: 20` was ruled out: a larger ceiling only buys a longer hang, still
ends in `cancelled`, and lifting a gate's ceiling weakens the gate.

What the job accepts and rejects is unchanged — every command-bearing step in every job of
`ci.yml` is byte-identical to `main`, and no job's `timeout-minutes` moved.
`scripts/__tests__/turbo-cache-save-bound.test.ts` pins the contract, because reverting this
fix is invisible: fold the split back into one step and the cache still works, every run
still passes, and the next transient stall ejects the next green pull request.
