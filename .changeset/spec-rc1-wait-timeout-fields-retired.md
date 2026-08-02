---
"@object-ui/app-shell": minor
"@object-ui/types": minor
"@object-ui/plugin-dashboard": patch
"@object-ui/plugin-report": patch
---

Upgrade to `@objectstack/spec@17.0.0-rc.1`, stop offering the retired `wait` timeout fields (#3101), and route the newly-adopted `combo` chart type.

**Breaking for authoring, and the reason to do it now**: the `wait` panel no longer offers
`waitEventConfig.timeoutMs` or `.onTimeout`. Both are `retiredKey()` tombstones as of spec
17.0.0-rc.1 (framework#4158), which means a value written there is **rejected at load** —
so until this lands, Studio can produce flow metadata the author's own runtime refuses.
That hazard opened the moment rc.1 published, independent of when this repo bumps.

`wait` never had a timeout: `onTimeout` had zero readers, so neither `'fail'` nor
`'continue'` ever happened, and `timeoutMs`'s only reader used it as the timer **duration**
when `timerDuration` was absent. Use **Duration** — it accepts a bare number as
milliseconds, making the old `timeoutMs: 60000` and `timerDuration: '60000'` the same wait.
Stored flows are converted by framework's D2 conversion; the designer simply stops offering
the entry. The two `zh` label overrides go with the fields.

#3101 asked for this to ride along with the bump rather than land alone, and that is
load-bearing: the sibling-block assertion is **bidirectional**, so deleting the fields
against a spec that still declares them fails in the other direction.

**`combo` is now a spec chart type** — the sole addition to `ChartTypeSchema` in rc.1 (19
members → 20). It had been a renderer-local family the chart renderer derived from the
series, so nothing classified it on the two surfaces that route a *spec* chart type: a
spec-valid `combo` fell through to the red "Unknown component type" panel on a dashboard
and to the out-of-spec notice on a report. Both now route it
(`widgetDispatch.SERIES_CHART_TYPES`, `planReportChart`). The renderer-local derivation
stays — it is what makes an authored `type: 'combo'` render rather than merely validate.

**Retired spec exports this repo bound to**, all removed upstream in spec 17.0.0:

- `JoinStrategy` / `WindowFunction` (framework#4286 tombstoned `query.joins` and
  `query.windowFunctions`: no engine or driver ever read either on the query path). They
  were derived off the spec enums under objectstack#4115's "come off the spec enum, not a
  restatement" rule; with no enum left, `data-protocol.ts` now restates the members locally
  — verbatim from the last spec that published them — as the objectui query-AST vocabulary
  they have become. The AST itself is unchanged.
- `PerformanceConfig`, retired with `dashboard.performance` (framework#3896). Nothing bound
  to it — `@object-ui/react`'s `usePerformance` declares its own interface and is untouched.
  The dashboard form is derived from the spec's own `dashboardForm`, so the field
  disappears from the inspector for free; its test now pins the absence.

**Three inverted pins fired, and are recorded rather than resolved.** objectstack#4171's
tripwires asserted that `NavigationItem`, `FormField` and `ConditionalValidation`'s branches
still erased to `any`/`unknown` upstream — the premise that justified objectui keeping local
declarations. rc.1 types them properly, so the assertions are inverted to state the new
fact. The burn-down each one asks for — deriving those types from the spec — touches
widely-used public types and is deliberately **not** bundled into a version bump; it is
tracked in #3177. `JoinNode`'s pin is gone outright: the symbol no longer exists.

**What the bump arms.** The reconciliation ledger's `subflow` and `decision` panels
feature-detect their spec exports and had never actually run — rc.0 predates the exports
(framework#4278). They now execute and pass. The `script` panel's full bidirectional check
stays deliberately skipped: rc.1 predates framework#4343, so the retired dispatch branches
are still contract keys there, and only the "offers nothing the executor ignores" direction
is meaningful. It arms itself on the next rc.
