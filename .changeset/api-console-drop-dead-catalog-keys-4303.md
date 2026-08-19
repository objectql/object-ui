---
'@object-ui/console': patch
---

API Console's endpoint catalog drops the `workflow` and `feed` entries — 7 endpoint declarations that could never render on any host

`SERVICE_ENDPOINT_CATALOG` keys are looked up directly in `/discovery`'s `services` map, which the framework keys by `CoreServiceName`. Neither `workflow` (5 endpoints under `/api/v1/workflow/*`) nor `feed` (2 endpoints under `/api/v1/feed/*`) names a `CoreServiceName` slot: the `workflow` slot was retired upstream (objectstack#4451) and `feed` never was one. Both were unconditionally hidden by the fail-closed lookup (ADR-0076 D12) — a miss is indistinguishable from "no such service" — so this changes no rendered output; it only removes two catalog entries that could never surface an endpoint.

Counter-probed against current objectstack `origin/main` before removal: no `registerService('workflow')`, no mounted `/api/v1/workflow` route, and no `/api/v1/feed` route anywhere in source — both are confirmed dead, not merely unused. Per objectui#4303's ruling, this is dead-code removal, not a rename: neither key has a correctly-spelled slot to move to.

#4240's tripwire test — which pins `SERVICE_ENDPOINT_CATALOG` keys against `CoreServiceName` and had carried `workflow`/`feed` as a documented exception set — is trimmed alongside the catalog: the exception set and its `#4303` reference are removed now that both keys are gone, so the assertion goes back to a plain "every catalog key is a canonical slot" with no carve-outs.
