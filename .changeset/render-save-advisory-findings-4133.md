---
'@object-ui/data-objectstack': patch
'@object-ui/app-shell': patch
'@object-ui/i18n': patch
---

Studio surfaces the runtime authoring gate's advisory findings instead of discarding them client-side

The framework's runtime authoring gate produces two kinds of verdict on a metadata write. Errors become a 422 and the author sees them. Advisories ride a **200** — the save succeeded, the row persisted, the version bumped — and until objectstack#7435 the server dropped them into a deduped `console.warn` behind a process-level set. That landing put them on the wire as an optional `advisories[]` on the save response, emitted only when non-empty, and objectui was still throwing them away one layer further out: `MetadataClient.save` parsed the body, returned it as an opaque `T`, and every call site awaited it for its side effect and discarded the value.

The measured case the fix is built on: a `nightly_purge` flow whose only defect is a `delete_record` node with `multi: true` and no filter yields `errors = 0 / advisories = 1`. The save returns 200, the flow goes live, and nothing anywhere tells the author it deletes every row. That matters most for exactly the authors Studio serves — a Studio tenant or an MCP/AI author has no `os lint` and no CLI config for `sys_metadata` overlay rows, so this gate is not the weakest of four doors, it is the only one.

`MetadataClient` now carries an `onSaveAdvisory` sink, invoked after a save whose response carried a non-empty `advisories[]`, and the console wires it in `useMetadataClient` — the one hook every app-shell write path takes its client from, so a single wiring covers `ResourceEditPage`, `StudioDesignSurface`, `EmbeddedItemEditor`, `DatasourceResourcePage`, `ObjectHooksPanel` and any future call site rather than a toast copied into twenty of them. The finding shape is re-exported from `@objectstack/spec` (`RuntimeAuthoringIssue`) rather than restated, so it cannot fork from the 422 `issues[]` it deliberately shares a declaration with.

The affordance is the warning tier and says "Saved" first. A successful save that reads as a failure is the specific defect this surface must not ship, so the toast acknowledges the write, lists `rule` + `message` + `hint` per finding with `where` as secondary context, and renders that text **verbatim** — `message` and `hint` are server prose composed by the gate's rules, not i18n keys. Only the frame around them is translated (`console.saveAdvisoryTitle`, ten packs). The sink is best-effort in both directions: a malformed finding is dropped rather than printed as blanks, and a throwing renderer cannot turn a save the server already committed into an error.

**What this does not surface yet, and why.** Studio's designer saves as a **draft** on every edit, and drafts are never gated — the framework returns at its D1 early-return (`if (args.state !== 'active') return null`) before running a single rule, so a draft save produces no findings at all rather than producing some that get withheld. The publish step that promotes a draft to active *does* run the gate, but the publish route returns no `advisories` field until objectstack#7294 lands. So a draft-then-publish flow renders nothing today, at both of its doors, for two different reasons; the active-mode save door renders findings now. That gap is pinned as a test rather than left for a reader to rediscover.
