---
---

Tests only — this publishes nothing, declared explicitly with an empty frontmatter
rather than left undeclared. No package `src/` behaviour moves; the only files added are
`packages/auth/src/__tests__/switchOrgIdentityReresolve-5719.test.tsx` and this changeset.

Pins that console identity **re-resolves across an organization switch**, and pins the
mechanism that actually provides it.

objectui#5719 observed that `AuthProvider.switchOrganization` never calls `loadSession()`,
while the framework derives `user.positions[]` inside `customSession` from
`session.activeOrganizationId` — so leg 3 of `useWorkspaceAdminStatus` would keep answering
for the PREVIOUS organization, and because that hook is `leg1 || leg2 || leg3` with
`isResolved` short-circuited to true on any positive leg, a stale `org_owner` reads as a
CONFIRMED admin in the new organization. The card was filed as an observation because its
last step could not be settled from this repo.

Measured against better-auth 1.6.28 driven standalone with the organization and bearer
plugins the framework always enables: `POST /organization/set-active` **does** hand back a
`set-auth-token`, so the objectui#4467 rotation subscription already re-resolves identity
and there is no defect. The mechanism, however, is an accident worth naming: the switch does
not mint a new session — `updateSession` writes only `activeOrganizationId` — it hands back
the **signed** `token.signature` spelling, while `createAuthClient.getSession()` stores the
**unsigned** `session.token`. Two spellings of one session, and `TokenStorage.set` notifies
on a value change.

Nothing declared that. Normalising either lane onto a single spelling — a reasonable-looking
tidy-up — would silently stop identity re-resolving across an org switch, with the
over-permissive consequence #5719 described and no test anywhere to catch it. These cases
are that test, including the owner-of-both control (so the pin cannot pass on code that
merely stopped reporting admin) and a counterfactual that fixes what the guarantee rests on.

No explicit `refreshSession()` was added: the rotation path already spends exactly one
`get-session` per switch, so an explicit call would make every org switch cost two.
