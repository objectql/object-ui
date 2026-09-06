---
'@object-ui/core': minor
'@object-ui/react': minor
---

row predicates on runtime record surfaces resolve `record.*` only; the bare-field and `data.*` spellings are no longer bound

Phase 2 of the row-predicate canon (objectui#5330, ruled 2026-08-20, option B;
Phase 2 ruled 2026-09-02 and amended 2026-09-05 on objectui#5741). Until now a
row predicate — `visible` / `disabled` / `enabled` on an action renderer, a row
action, a `record:alert`, a `page:header` action, a conditional-formatting
`condition` — bound the row three ways: canonical `record.status`, bare
`status`, and `data.status`. The two non-canonical spellings are retired on
every runtime record surface, in both evaluation tiers (`evalRowPredicate` /
`partitionRowsByPredicate` in `@object-ui/core`; `usePredicateRecordContext` +
`useCondition` in `@object-ui/react`) and for both dialects: a legacy
`${data.x}` / `${x}` string on a row surface retires with the CEL spellings.

**What a retired spelling does now: it faults, exactly as it already did on the
server** (`buildScope({ record })` mounts exactly `['record']`, so `status` and
`data` are unknown variables there), and each surface applies its EXISTING
fault policy — no runtime detector, no "treat as absent" special case, no
uniform override:

- `evalRowPredicate` / `partitionRowsByPredicate` (row kebab, selection bar,
  `page:header` actions, conditional formatting): the caller's `fallback` —
  hidden / every row excluded / no style — reported once by the existing fault
  warning, which names the unknown variable (`Unknown variable: status`) and,
  on the fast route, carries the `record.` hint.
- `useCondition` legs that opt into `throwOnError` (`action:button` and
  `action:menu` `visible`, `DeclaredActionsBar` `visible`): fail-closed —
  hidden on every row, reported once as `was hidden/disabled: its predicate
  threw — status is not defined`.
- the non-throwing `useCondition` legs (`action:icon` / `action:group`
  `visible`, every `disabled` / `enabled`, `record:alert`): fail-soft — shown /
  greyed / enabled on every row, with the evaluator's own console line.
- a host scope that carries its OWN `data` (app-shell's ambient `data: {}`) is
  left standing: `data.*` on a record surface then reads the host's object — a
  constant, silent `false` — which is what "no longer bound to the row" means.

The Phase-1 deprecation warning is removed with the bindings:
`warnNonCanonicalRowSpelling` and `resetRowPredicateCanonWarnings` are no
longer exported from `@object-ui/core`. `detectNonCanonicalRowSpelling`,
`ROW_PREDICATE_CANONICAL_ROOT` and the `NonCanonicalRowSpelling` type stay
exported — the offline instrument for sweeping authored metadata.

The layer rule is unchanged: `data` remains the canonical root on
metadata-editing surfaces (ADR-0089 D3, `CANONICAL_ROOT_BY_LAYER`), and
app-shell's metadata-admin `SchemaForm` / `predicate.ts` keep binding
`{ data: row }` through their own evaluator.

No stored-metadata survey, export or migration rewrite was run (the maintainer
ruled the stored population out of scope, 「不考虑存量」); the Phase-1 warning
period was the notice.

Release note: Phase 1 (PR #5737 — the canon statement plus the warning) shipped
in `@object-ui/core@17.6.0` (npm, 2026-08-24) although its changeset
`.changeset/row-predicate-record-canon-5330.md` is still pending on `main`, so
the next CHANGELOG section lists Phase 1 and this Phase 2 together: the warning
it describes was live from 17.6.0 and is gone from this release on.
