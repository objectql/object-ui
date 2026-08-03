---
"@object-ui/app-shell": patch
---

Five metadata designers stop rendering keys `@objectstack/spec` rejects, and start
rendering the keys it declares (objectui#3275, objectui#3281).

The previews and the console's sample drafts had been wrong TOGETHER, which is
why the gallery looked healthy. objectui#3266 corrected the samples and the
gallery immediately rendered LESS — agent's TOOLS and KNOWLEDGE blocks, skill's
TRIGGER PHRASES, app's per-item row and `Dashboard` badge, and datasource's
CAPABILITIES all vanished or degraded. Nothing had broken: those blocks were only
ever lit up by metadata that cannot be saved. This is the renderer half of that
finding, and the same fix objectui#3236 / PR #3258 made to `ToolPreview`.

A preview that renders a rejected key does not just show something useless — it
tells the author "this is correct" until publish refuses it. For AI-generated
metadata that is where a stale key hides and multiplies, so every read below was
deleted rather than kept behind a fallback (AGENTS.md #0.1).

**Retired keys, deleted** — each is a `retiredKey()` tombstone rejected by name:
`agent.tools` (objectstack#3894 — an agent reaches exactly the tools its skills
declare, ADR-0064), `agent.knowledge` (objectstack#3896 — it never scoped
retrieval), `skill.triggerPhrases` (objectstack#3896 — phrases were never matched
against a user's message).

**`AppPreview` / `AppNavCanvas`** — `AppSchema.navigation` is a discriminated
union on `type` whose every branch is `.strict()`. Both surfaces ignored the
discriminator: kind came from `it.object` / `it.dashboard`, the route from
`it.path ?? it.href ?? it.route ?? it.url`, and the landing from
`landingRoute ?? landing ?? defaultRoute ?? '/'`. Not one of those is a key
(`landing` was removed in objectstack#4001), so the reading was exactly inverted —
a valid app showed generic badges, no targets and an invented `Landing: /`. Now
`type` is the badge, each branch's own key is the target
(`objectName`/`pageName`/`dashboardName`/`url`/`reportName`/`componentRef`/
`actionDef.actionName`), and the route comes from `resolveHref`, the shell's own
nav → URL mapping that `useNavPins` and `SearchResultsPage` already share — so a
link in the preview is the link the runtime follows. `homePageId` is rendered as
the nav item **id** it is, resolved to the entry it selects; it is never printed
as a path.

**`DatasourcePreview`** — `capabilities` is a `DatasourceCapabilities` object of
boolean flags, and the preview tested `Array.isArray`, lighting the block up only
for the pre-17 token array the schema refuses. It now lists the flags set to
`true`. The `driver ?? d.type` fallback is gone (the schema's own hint is
`type` → `driver`), as is the `default` pill behind `isDefault ?? default` —
routing is declared at stack level via `datasourceMapping`, never on the
datasource.

**`SkillPreview`** — the trigger-conditions table read `cond.expression ??
cond.value` under a `cond.type` gutter, so a spec-valid condition rendered as
`COND | sales_order` with the field it tests and the operator it applies both
invisible. It is now three columns — `field` / `operator` / `value` — straight off
`SkillTriggerConditionSchema`, and a row missing one of those required cells says
so instead of rendering a blank that reads as fine.

**`ValidationPreview`** (objectui#3281) — drew nine rule types where the union has
six. `unique`, `async` and `custom` were removed by one paragraph of
`validation.zod.ts`, because a rule must be a deterministic, synchronous,
side-effect-free predicate over one record; each now redirects to the layer that
does the job (a unique **index** — a SELECT-then-INSERT rule is racy, TOCTOU — a
form-layer check, a lifecycle hook). Two alias fallbacks went with them:
`condition ?? expression` and `pattern ?? regex`, where neither `expression` nor
`pattern` has ever been a key on any branch — which is precisely why a bogus
`expression` sat unnoticed in the console sample. Two branches were also simply
wrong: `conditional` read `condition` instead of its `when` (a valid rule showed
"No expression set", and its nested `then`/`otherwise` now render), and
`json_schema` had no branch at all, so a valid rule displayed "Unknown rule type".

`validation.object` is deliberately still read: `anchors.ts` registers a
standalone `validation` resource matched by `anchorByField('object')`, so a
standalone rule genuinely carries it. Not every key a union omits is residue.

Verified in the preview gallery before and after, per designer; each preview also
gains tests that feed a spec-valid draft and assert the block renders, then feed a
stale draft carrying the retired key and assert nothing renders from it.
