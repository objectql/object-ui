---
'@object-ui/plugin-timeline': minor
'@object-ui/components': minor
'@object-ui/types': minor
---

Retire the `timeScale` alias on the timeline node — `scale` is the only axis spelling
(objectui#6355, maintainer ruling 2026-08-27).

**BREAKING for authored metadata.** `timeScale` was this renderer's pre-spec spelling of the
Gantt axis bucket. `scale` is canonical — it is `@objectstack/spec` `ui/TimelineConfig.json`'s
axis key and the key the renderer preferred (objectui#6170 ruling, 2026-08-25: `timeScale`
goes the alias-retirement route, not a silent second spelling). objectui#6355's ruling
retires it immediately, with no phased window, while the project is at startup stage.

**What breaks, and how you will find out.** A timeline document that spells `timeScale` is
now **refused**, loudly, at the authoring boundary:

- `TimelineSchema.timeScale` is declared `?: never` — writing it is a type error;
- the Zod twin declares `z.never().optional()` — parsing a document that carries the key
  fails with `invalid_type` / `expected: never` on the `timeScale` path.

The fix is a rename: `timeScale` → `scale`. The accepted values are unchanged (`hour`,
`day`, `week`, `month`, `quarter`, `year`), so no value needs rewriting.

**Why a tombstone rather than deleting the key.** `BaseSchema` is `.passthrough()` on the
Zod side and carries `[key: string]: any` on the TS side, so an *undeclared* key is accepted
unvalidated by both halves. Deleting `timeScale` outright would have let the retired spelling
parse green and type-check green while the renderer no longer read it — the Gantt axis would
silently fall back to the `month` default, the chart would change bucket, and nothing would
error. That is the silent axis breakage objectui#2942 closed, running in the other direction,
and it is the specific outcome this retirement is shaped to prevent. Keeping the key declared
as `never` on both halves is what makes the removal audible. Absent stays valid on both, so a
document that never wrote the alias is untouched.

Also in this change:

- `resolveTimelineScale` drops the `?? schema.timeScale` fallback read; its parameter narrows
  to `{ scale?: unknown }`.
- The designer drops its deprecated `timeScale` input. The `scale` input already offers all
  six buckets.
- `ObjectTimeline` now emits the resolved axis under `scale` when it composes the schema it
  hands to the renderer. It previously wrote the alias, which would have made **every**
  object-bound Gantt fall through to the `month` default the moment the fallback read went —
  silently, since that is a composed schema no author ever sees. Writing `scale` after the
  spread also restores the precedence the surrounding code intends: a `timelineConfig.scale`
  now actually beats a flat `schema.scale`, where under the alias the resolver's
  `scale ?? timeScale` ordering let the flat key win.
- The two in-repo authors are migrated in the same change: the schema-catalog
  `gantt-style-timeline.json` fixture and the registration's own `examples.gantt` block.
- Docs drop the `timeScale` row and gain a retirement callout;
  `packages/components/.../TIMELINE.md`'s Gantt table now documents `scale` with the full
  six-value vocabulary it has accepted since objectui#2942 (its row still claimed three).

Version note: `minor`, not `major`, per AGENTS.md §版本号策略 — objectui's major tracks the
`@objectstack` major and all publishable packages share one `fixed` group, so a breaking
narrowing is declared `minor` with the break spelled out here.
