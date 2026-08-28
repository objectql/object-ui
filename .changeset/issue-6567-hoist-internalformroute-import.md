---
---

Test-only: in `apps/console/src/components/FormPage.predicateScope.test.tsx`, hoist
`InternalFormRoute`'s import from a dynamic `await import()` inside the
`hop1SessionPrincipal` case to module scope. That load was costing 10204ms of the
case's 15000ms budget — it is the file's first value request for
`@object-ui/app-shell`, aliased to source — which made the file's one anti-inert
case fail under full-project parallel load. Same module, same binding, loaded
before the timed window instead of inside it. No published behaviour changes.
