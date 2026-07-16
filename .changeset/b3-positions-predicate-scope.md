---
'@object-ui/app-shell': patch
---

Forward the authenticated user's `positions` into the client predicate scope (`current_user.positions`) in the console shell and the record form page. Position-gated select options (`'admin' in current_user.positions`, ADR-0058 / objectui#2284) now hide client-side like they do everywhere else, instead of failing open as visible and only being rejected by the server on submit — `positions` is the actor shape the framework rule-validator actually binds and enforces. Docs, the schema-catalog role-gated example, the skills guide, and inline examples switch the role-gating spelling from `current_user.roles` (never bound server-side, so never enforced) to `current_user.positions`.
