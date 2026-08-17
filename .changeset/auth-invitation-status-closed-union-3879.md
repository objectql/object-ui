---
'@object-ui/auth': minor
'@object-ui/app-shell': minor
---

`AuthInvitation.status` is the closed four-member union it always documented, enforced at the auth client's wire boundary.

The field was declared `status: string` while its own doc comment enumerated
`'pending' | 'accepted' | 'rejected' | 'canceled'`, and `createAuthClient` cast
better-auth's `any` responses straight to `AuthInvitation[]` with no check. The
enumeration was therefore advisory: any value a backend stored reached the
console untouched, where the invitations screen coloured it through a
`default: 'secondary'` badge arm and printed it with
`defaultValue: inv.status` — the raw wire string rendered as interface copy, in
all ten packs (objectui#3879). Nobody could trigger it today, because the four
are what better-auth writes; it was the contract that was loose, and a loose
consumer is where an unexpected value would have hidden.

`AuthInvitationStatus` now carries the union and **binds better-auth's own
`InvitationStatus`** rather than restating it, the way `org-roles.ts` binds the
spec's `BUILTIN_MEMBERSHIP_ROLES` — a member-for-member copy is the state one
upstream release away from drifting silently. The runtime list
(`AUTH_INVITATION_STATUSES`) is derived from a total map keyed by that union, so
a fifth status upstream is a build failure here rather than a gap in the guard.
`isAuthInvitationStatus` is exported alongside, and all four invitation-returning
client methods (`listInvitations`, `listUserInvitations`, `getInvitation`,
`inviteMember`) narrow their wire rows through it.

Behaviour change, stated because it is one: an invitation whose `status` is
outside the set now **fails loudly** — the call rejects with a message naming the
value it refused and the four it expected — instead of resolving into a badge.
Both call paths already render a rejection with a retry, so the throw lands on a
designed surface. Degrading quietly was the alternative and was deliberately not
taken: a neutral label is how the raw value shipped in the first place, and
dropping the row would delete an invitation from an administrative ledger without
saying so. The console's badge switch is exhaustive over the union now and has no
`default:` arm, so if better-auth ever adds a member the type-check gate stops the
build at the one place a human has to choose a colour.

Consumers assigning an arbitrary string to `AuthInvitation.status` (a hand-built
fixture, a mock) will need one of the four members.
