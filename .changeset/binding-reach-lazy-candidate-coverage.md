---
"@object-ui/console": patch
---

The binding-reach probe was under-reporting its own coverage by six object blocks, silently (#3149).

`public-block-binding-reach.test.tsx` selects what to probe by filtering `getPublicConfigs()`
for a declared `objectName` input. The console registers most object blocks with
`registerLazy`, and a pending stub carries no `inputs` — `Registry.getMeta` says in as many
words that a consumer must read that as *"not yet known"*, not as *"declares no props"*. The
filter read it as the latter, so `object-chart`, `object-kanban`, `object-calendar`,
`object-gantt`, `object-timeline` and `object-map` — six Tier-A blocks, every one declaring
`objectName` as **required** — dropped out of the candidate set while the suite reported eight
green probes and no gap.

That is objectui#2953's shape (a lazy registration falling out of the contract) recurring in a
consumer, and objectstack#4472's shape recurring inside the suite written to answer it: a gate
whose stated scope was wider than its reach. The coverage guard could not see it — `length > 0`
and `toContain('object-form')` both stayed true at 8 of 14.

- Pending public lazy loaders are resolved through the registry's own `loadLazy` before
  candidates are selected — driven off the recorded loaders, not a hand-written list of plugin
  imports that would drift out of step with `register-plugins.ts` and reintroduce the same
  shrinkage by another route.
- The guard is now an **exact** candidate list, the lesson `public-contract.test.ts` already
  carries: the failure mode is a set getting smaller, and only an exact comparison makes both
  directions a deliberate edit. Verified by simulating the regression — with resolution
  disabled the assertion fails naming the missing blocks.

All six were already wired correctly (`ObjectChart` reads the context itself; gantt/timeline/map
and kanban/calendar have context→prop wrappers), so this found no new defect of the #3144 kind.
It found two more probe artifacts, which is the same lesson a third and fourth time — a
plausible value for every input is not a plausible *configuration*:

- **`data` supersedes the binding.** `ObjectChart`'s fetch is guarded by
  `if ((schema.objectName || schema.dataset) && !boundData && !schema.data)`, and the spec
  glosses `data` as static data to chart *instead of* binding via `objectName`. Filling it and
  then reporting "objectName never reached" would have been the probe manufacturing its own
  finding. Binding-superseding inputs are now excluded, narrowly and with the guard quoted.
- **Teardown is not the subject.** `object-map` mounts maplibre-gl, whose `map.remove()` throws
  in jsdom for want of a WebGL context. Unmount is caught so the assertion speaks to data reach;
  an error thrown during *render* still propagates.

Coverage after this: 14 of 14 object-bound public blocks. The rest of #3149 — bindings other
than `objectName`, the `record:*` family under a record context, and the display primitives —
is untouched and still open.
