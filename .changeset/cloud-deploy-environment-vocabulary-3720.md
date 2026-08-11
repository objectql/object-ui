---
---

`CloudDeploymentConfig.environment` is now declared a deliberate deploy-target vocabulary, with a pin test — no exported type changed, so nothing to release.

objectui#3720 recorded that `packages/data-objectstack/src/cloud.ts` hand-writes a third environment spelling (`'development' | 'staging' | 'production'`) beside the two enums `@objectstack/spec` declares, and left the disposition open: converge onto a spec enum, or write the divergence down as deliberate.

The measurement picked the second. There is no producer-side deploy-target type to converge onto — as of `@objectstack/client@17.0.0-rc.5` the client exports no `cloud` namespace at all, so `CloudOperations.deploy` optional-chains into `undefined` and no wire surface has ever accepted or rejected one of these values. Deriving from `EnvironmentType` instead would assert a subset relationship no producer confirms, and an `Extract` of three members degrades silently: the day spec drops one, the union loses it with no error anywhere. That is the drift the card was filed about, re-introduced in the shape of a fix.

So the union is unchanged and the reasoning is now in the file: a doc comment naming both spec enums with their real member lists, why neither is imported, and the `staging` trap — `staging` is not a `DiscoveryEnvironment` member, and spec's own `NODE_ENV_TO_DISCOVERY_ENVIRONMENT` folds it onto `sandbox`, so a deploy target must never be copied onto a discovery response. `cloud-environment-vocabulary.pin.test.ts` makes each of those claims executable rather than decorative: the union members are pinned at compile time AND in source text (so a member added without touching the note goes red on the pair), the comment is pinned on the tokens that carry the reasoning, and the spec-side facts are pinned against the installed spec so a bump that moves either enum lands on the breakpoint the card named instead of drifting past it.

No frontmatter: the exported `CloudDeploymentConfig` type is byte-identical, the change is a comment plus a test, and there is nothing for a consumer to react to.
