---
'@object-ui/app-shell': patch
'@object-ui/console': patch
---

fix(approvals): derive approver identities from `positions`, not the retired `user.roles` (objectui#5424)

Framework ADR-0090 D3 renamed the session's `roles` key to `positions` with no
deprecation window, and the protocol-17 session face emits no `roles` key at
all. Three client sites still read it:

- **`sharedUserFeeds.approverIdentities`** — the bell badge, the bell's
  Approvals tab and Home's To-do card. It read nothing else, so it sent **no
  `role:` identity at all**: an approval addressed to a position rather than to
  a person matched nothing and vanished from all three surfaces, silently.
- **`approvalsApi.buildApproverIdentities`** — "My Pending" and the
  Approve/Reject enablement. It also splits the scalar `user.role`, so it
  degraded rather than dying: it still yielded `role:user` while dropping every
  business position name (`manager`, `finance_approver`, …).
- **`AppContent`'s expression user** — forwarded a `roles` key that was always
  `undefined` into every CEL predicate context. Removed; `positions` and
  `isPlatformAdmin` were already forwarded correctly beside it.

The retired spelling is **not** kept as a fallback — pairing the two is what
ADR-0090 D3 forbids, and `packages/auth/src/types.ts` says so on the
declaration.

`AuthGuard`'s `requiredRoles` gate (the fourth surviving reader) is deliberately
untouched: it is a semantics decision, not a rename, and is deferred to a
maintainer ruling.
