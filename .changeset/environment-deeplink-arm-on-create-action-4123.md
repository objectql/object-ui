---
'@object-ui/app-shell': patch
---

`?runAction=create_environment` is no longer consumed when the environments toolbar has no create action to run it on.

`EnvironmentListToolbar` armed the deep link on `toolbarActions.length > 0` — the presence of *any* toolbar action. Consumption of this deep link is modelled as stripping the param from the URL, so arming is destructive: a toolbar carrying some other action stripped `?runAction=create_environment` and triggered nothing (measured with the real `action:bar` + `action:button` runner: `urlParam=null execute=0`). Because the strip *is* the consumption, the user's intent was unrecoverable — reloading could not retry it, and the welcome page's "Create your environment" CTA (#844) simply landed on the list with no dialog and no way to ask again.

Arming now keys on the create action actually being present. When it is not, the URL is left alone, so the next mount that can act on the deep link still does — a reload, or the action arriving with fresh metadata.

The two lists that used to disagree are now one. The toolbar filtered placement only (`locations`), while `action:bar` additionally applies the ADR-0066 D4 capability gate (`requiredPermissions`) to what it renders — so a create action the caller may not invoke was counted here and dropped there, which is the divergence that made the bug reachable without any change to cloud metadata. The toolbar now builds its list with both of the bar's predicates (`actionRendersAt` + `useCapabilityGate`, the shared hook that exists precisely to keep self-filtering surfaces from drifting), and every affordance derived from that list follows: the loading skeleton is held only for a create button that can actually arrive, and the plan-locked "Add environment" upgrade CTA — which stands in for the create action — is not offered when there is no create action to stand in for.

The `#3803`-verified consumption ordering is untouched and re-pinned: the runner still consumes `autoTrigger` before the parent strips the param.
