---
"@object-ui/auth": minor
"@object-ui/app-shell": minor
---

feat(console): scoped-invitation placement — invite someone straight into a
business unit and positions (framework ADR-0105 D8)

An invitation may now carry PLACEMENT INTENT: the business unit the invitee
lands in and the positions they are assigned when they accept. A plant admin's
invitee arrives already in the right unit and role instead of waiting on a
platform admin to finish the job by hand.

- `@object-ui/auth`: `inviteMember` accepts optional `businessUnitId` /
  `positions` (passed through better-auth's invitation `additionalFields`), and
  a new `describeDelegableScope()` reads
  `GET /api/v1/security/my-delegable-scope`.
- `InviteMemberDialog`: an optional "Placement" section listing **only** the
  units the issuer may place into and the positions they may hand out.
  Positions appear once a unit is chosen — an unanchored assignment is refused
  by the server, so offering it first would mislead.

The narrowing is convenience, not the boundary: the server authorizes the pair
against the ISSUER's `adminScope` (ADR-0090 D12) at issuance and rejects the
whole invitation when it is out of scope. Accordingly the section is **hidden**
whenever the caller has no delegable authority, or the deployment exposes no
delegated-administration runtime at all (the endpoint answers 501 ⇒ `null`) —
never a form the server would refuse. An ordinary invitation is unchanged: with
no placement chosen, the request body is byte-identical to before.
