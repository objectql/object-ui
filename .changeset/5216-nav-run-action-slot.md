---
'@object-ui/types': minor
'@object-ui/layout': minor
'@object-ui/app-shell': minor
---

Consume the declared nav `runAction` slot; retire the private `?runAction=` string convention

An `object` navigation item can now declare `runAction: '<actionName>'` and the shell will run that action once on arrival at the object's list surface, through the ordinary execute path — so param dialogs, confirms and entitlement gates all still apply. The slot is `@objectstack/spec`'s `ObjectNavItemSchema.runAction`; objectui now reads it instead of a private convention.

- `NavigationItem` declares `runAction` (derived from the spec's object-nav variant), and objectui's own nav schema stops stripping it — `objectui validate` previously discarded the key, so an entry carrying a deep link validated clean with the deep link thrown away.
- `resolveHref` encodes it onto the list href as the reserved `?runAction=` param, on the list landings only. A `recordId` entry resolves to a record page, which has no list toolbar to answer it, so the slot is not encoded there.
- The deep link is honoured on **every** object list, not just the environments list. The action is armed only when it is actually present at `list_toolbar`; a name no action answers to runs nothing and deliberately leaves the URL untouched, so a later mount with fresher metadata can still honour it. Undefined references are rejected upstream at authoring time by `defineStack`.
- The param name now has exactly one definition (`NAV_RUN_ACTION_PARAM`, exported from `@object-ui/layout`) and is registered in the console's reserved-param collision check. It was previously a bare literal hand-written at both the producing and consuming ends, declared by no schema and listed in no registry.
- `CloudOnboardingNext` takes an optional `properties.createAction` (defaulting to `create_environment`) instead of hand-concatenating its deep link.
