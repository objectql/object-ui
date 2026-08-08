---
"@object-ui/app-shell": patch
---

console: hold the environment list's create CTA with a skeleton until entitlements
resolve, instead of showing a label that is about to be overwritten (objectui#3482,
part of cloud#1049).

`EnvironmentListToolbar` presents a state-aware create affordance — "Set up your
production environment" / "Add development environment" / an upgrade prompt — decided
from `GET /cloud/environment-entitlements`. While that request was in flight the
toolbar rendered the action's metadata label, so the button visibly changed its
wording the moment the response landed. The two texts are owned by different
packages (the cloud translation bundle vs this repo's locale packs), which made the
swap read as an inconsistency rather than a load.

The in-flight state now renders a `Skeleton` sized like the button it stands in for,
matching the adjacent `cloud:onboarding-next` welcome CTA. Only the create action is
withheld — other toolbar actions never re-label, so they keep rendering — and a
toolbar without a create action gets no skeleton at all. The skeleton is never
terminal: when both entitlement signals fail, the resolution settles as
`{ ready: false, source: 'unknown' }` and the neutral metadata label is shown, which
remains the honest text for a state where "which create is this?" is genuinely
unknown.
