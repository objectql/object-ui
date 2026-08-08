---
"@object-ui/i18n": patch
---

Resolve `_views` translation keys by the bare view name only — the prefixed full name is no longer a second candidate

`useObjectLabel().viewLabel` / `viewDescription` / `viewEmptyState` build their key by stripping the object prefix off the runtime view id (`crm_opportunity.pipeline_kanban` → `objects.crm_opportunity._views.pipeline_kanban.<tail>`). Until now, if that bare key missed, the resolver **also** tried the prefixed full name — `objects.crm_opportunity._views.crm_opportunity.pipeline_kanban.<tail>` — so a bundle authored against the prefixed spelling resolved too.

**Behavior change:** it no longer does. A `_views` entry keyed by the prefixed full name is not read at all; the label falls back to the metadata default, exactly as it would if no translation had been written. Bundles keyed by the bare view name — the only spelling the extractor emits and `os lint` accepts — are unaffected.

This closes an asymmetry, not a feature. The server-side resolver reads the one bare key (objectstack#5165), so a prefixed-key bundle produced a **translated label in the Console and English everywhere else**: the REST boundary, mobile, plain HTTP and SDUI consumers do not run this second resolution pass. The half-success was harder to notice than a clean miss, and it fossilized a second de-facto spelling of a key the platform has now converged on: per the objectstack#5164 ruling (2026-08-06, option A), the canonical `_views` key is the runtime view identity's bare name, with the i18n extractor deriving it from the view composer (objectstack#6124) and `packages/lint` enforcing that single spelling (objectstack#6038). This is the third and last leg of that convergence.

The object-name axis is untouched: a bundle written against the short object name (`objects.opportunity._views.…`) still resolves when the runtime presents the namespaced name (`crm__opportunity`).

**If a label stopped translating after this upgrade,** its `_views` key is written with the object prefix. Drop the prefix — `_views.crm_opportunity.pipeline_kanban.label` becomes `_views.pipeline_kanban.label`. `os lint` names these for you: a prefixed key is reported as `translation-target-unknown`, because no view of the object declares it.
