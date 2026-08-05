---
"@object-ui/app-shell": patch
---

The flow designer no longer seeds new `wait` nodes with the retired
`waitEventConfig.onTimeout` (objectui#3316).

FROM: `defaultNodeExtras('wait')` returned
`{ waitEventConfig: { eventType: 'timer', onTimeout: 'fail' } }`, and the
one-click revision loop (`addReviseLoop`) wrote `onTimeout: 'fail'` onto the
`wait` node it creates. TO: both seed only the event flavor — `{ eventType:
'timer' }` and `{ eventType: 'signal', signalName: 'revision' }`. The author
fills in `timerDuration`.

**This is a behaviour fix, not a cleanup.** `waitEventConfig.onTimeout` was
retired in `@objectstack/spec` 17 (framework#4158) via `retiredKey()`, i.e.
`z.never().optional()` — it is not a silently-stripped extra but a hard
`FlowNodeSchema.parse()` error carrying its own prescription ("It had no
readers at all … Delete the key."). Every `wait` node dragged out of the
palette, inserted on an edge, or created by the revision-loop button therefore
carried a key the loader rejects, so publishing a flow the author had merely
assembled returned 422. The other half of the same retirement had already
landed here — the label overrides came out of `i18n.ts` and the two fields came
out of the hand-written node form (`inspectors/flow-node-config.ts`) — but the
block that *produces* the key was missed.

A new `flow-canvas-seeds.spec-parse.test.tsx` pins the invariant for the next
retirement: every seeded node shape (all `NODE_PALETTE` types plus `start` /
`end` / `http_request` / `boundary_event`) is run through the spec's own
`FlowNodeSchema`, and the revision-loop node is captured from a real button
click and parsed the same way. Two deliberately different criteria: the strict
sibling blocks (`waitEventConfig` / `connectorConfig` / `boundaryConfig`) get a
full-parse verdict plus an explicit `[REMOVED]`-tombstone check that names the
offending seed key; the `config`-rooted seeds (`approval` / `notify` / `http`)
— invisible to `FlowNodeSchema`, whose `config` is a permissive record, and
deliberately partial, since the author still supplies notify's `title` and
http's `url` — are checked key-level against the spec's published
`ApprovalNodeConfigSchema` / `NotifyConfigSchema` / `HttpConfigSchema`.

No other `defaultNodeExtras` branch was affected: the remaining seeds
(`connector_action` / `boundary_event` / `approval` / `notify` / `http` /
`script` / `start`) were each checked against the spec and are clean.
