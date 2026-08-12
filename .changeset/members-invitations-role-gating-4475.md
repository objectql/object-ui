---
'@object-ui/app-shell': patch
'@object-ui/i18n': patch
---

Members & invitations tabs gate their affordances by org role instead of letting the server's 403 be the UI (#4475)

A user whose organization role is `member` opened the workspace members page and
was shown an enabled **Invite member** button plus a per-row **Member actions**
menu carrying **Remove member** — on every row, the workspace Owner's included.
Nothing was hidden or disabled; the action only failed after the user had
committed to it. The Settings tab of the same page already gated correctly; the
members and invitations tabs never got the same treatment.

The affordances are now narrowed to the roles that can actually use them, keyed
on the active member's role — the same source the role-change menu on this page
already reads. Which roles those are is **measured against the routes that
enforce them**, not assumed to be "owner":

| affordance          | route                             | permission              | roles                         |
|---------------------|-----------------------------------|-------------------------|-------------------------------|
| Invite member       | `/organization/invite-member`     | `invitation:["create"]` | owner, admin, delegated_admin |
| Remove member       | `/organization/remove-member`     | `member:["delete"]`     | owner, admin                  |
| Cancel invitation   | `/organization/cancel-invitation` | `invitation:["cancel"]` | owner, admin                  |

Three different gates, because `delegated_admin` holds `invitation:["create"]`
without `member:["delete"]` and deliberately without `cancel` — so it keeps the
invite button and the copy-link action while losing remove and cancel. A single
owner check could not express that.

An actor left with no row action at all gets no menu rather than a trigger that
opens onto nothing, and the members page explains the absence where the Invite
button used to sit, in the Settings tab's own voice. An unresolved role is
treated as the least privileged, so nothing privileged is offered to a viewer
whose membership could not be read.

Reading the pages is unaffected: the member list and the invitation ledger still
render in full. Whether `org_member` should be able to read the invitation
ledger at all is a separate, server-side question.
