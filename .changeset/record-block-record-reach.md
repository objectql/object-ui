---
"@object-ui/console": patch
---

The `record:*` family now has behavioural evidence — until now "it works under a record page" was an assumption (#3149 layer 3a).

`public-block-binding-reach.test.tsx` (objectstack#4472) asks whether a declared `objectName`
reaches the data layer when a block is mounted bare. Every `record:*` block is outside that
question by construction: they take their subject from `<RecordContextProvider>`, so mounted
bare they correctly do nothing, and "made no data call" says nothing about whether they work.

That gap is the exact place objectstack#4413 lived — `record:details` / `record:highlights` /
`record:path` / `record:related_list` published props no renderer read, four blocks rendered
blank on a real record page, and every gate stayed green. The framework check compares two
declarations; the binding-reach probe cannot see this family at all.

`apps/console/src/__tests__/record-block-record-reach.test.tsx` mounts all **11** public
`record:*` blocks under a record context twice, with two different records of the same object,
and asks whether anything changes — in the DOM or in the data calls. Behavioural coverage across
the two probes goes 14 → **24** of the 57 curated blocks (`record:related_list` is in both:
binding-reach ledgers it as unable to fetch without a parent, and this probe is what finally
shows it fetching once one is bound — turning that ledger entry's stated reason from a claim
into a checked one).

- **A differential, not "renders non-empty".** #3149 records the decision *not* to cover the
  display primitives precisely because "renders something" is also true of a block that ignores
  every input it declares. Adding a gate that reports green without checking anything is what
  objectstack#4472 exists to eliminate. A block rendering the same fixed shell for two different
  records scores zero.
- **Two records, not bound-vs-unbound.** An unbound control differs in tree shape, so `useId`
  values shift and everything "differs" for reasons unrelated to the record.
- **The instrument is checked, not trusted.** Each block also renders record A a *second* time;
  that mount must be byte-identical to the first. If it ever isn't, "A differs from B" stops
  meaning "the record reached the output", and the file says so instead of staying green.
- **A crash fails as a crash.** SchemaRenderer paints an error card on a throw, and a crashed
  block renders the *same* card for both records — which would land in the "no difference"
  bucket and read as a finding about its binding. Asserted separately.
- **Hermetic.** Blocks in this family call bare `fetch` (`/api/v1/security/explain`); under
  happy-dom that resolves to `localhost:3000`, so the probe used to "work" only because the
  connection was refused — 24 ECONNREFUSED lines per run, and different behaviour for anyone
  with a dev server on that port. `fetch` now rejects immediately and its URL joins the same
  call log, so a block binding through bare fetch is credited rather than reported unbound.

Eight blocks respond to the bound record. Three are ledgered with the reason and the host path
NAMED, because "host-fed" is only a reason while a host actually feeds it:
`record:discussion` (DiscussionContext, mounted by RecordDetailView) and `record:reference_rail`
(`entries` injected by `buildDefaultPageSchema`) check out — **`record:activity` does not**, and
that is #3165: it renders `items={[]}` hard-coded, nothing supplies items on any path, and its
eleven declared inputs are filters over a feed that is always empty. Ledgered rather than fixed
here because the fix is a feature, not the missing-bridge one-liner #3144 turned out to be; the
ledger's both-directions assertion forces the entry out the day it starts working.

**#3149 layer 2 lands with it, in the only form the codebase offers.** The slice the issue
proposed — `recordId` on `object-form` / `object-master-detail-form` / `embeddable-form` — does
not exist: no public block declares a `recordId` input at all (the only `recordId`/`resourceId`
inputs in the repo are on `view:detail` and `detail-view`, neither of them public). Same result
objectstack#4472's direction (d) hit — a slice proposed from the declarations, unavailable once
you look at what is actually declared. What is available is stronger: `record:related_list` and
`record:line_items` both bind a **required** `relationshipField` + `childObject` that must land
in the child query, checkable only under a record context. Both do, scoped to the bound parent.
The "same mechanism, different assertion" hypothesis #3149 wanted tested before anyone widens
the sweep holds, and it cost one assertion on mounts that were already happening.
