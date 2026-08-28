---
'@object-ui/plugin-dashboard': patch
---

`DashboardRenderer` drops the unreachable `DatasetWidget` fork from its self-contained
(card-less) branch, leaving that branch to render `SchemaRenderer` unconditionally
(objectui#4620).

`isSelfContained` is defined as `widget.type === 'metric' && !datasetBound`, and the
`isSelfContained` arm of `renderedNode` then forked on `datasetBound` a second time. The
`datasetBound` side of that inner fork could never execute: reaching it required
`isSelfContained` to be true, which requires `!datasetBound`. Behaviour is unchanged —
the removed arm never ran, and the reachable fork in the Card branch (the one that gives
a dataset-bound metric its title and border chrome) is untouched.

The cost was to readers, not to users: the shape read as "both branches handle
dataset-bound widgets" when only one can, and a previous PR mirroring this fork onto
`DashboardGridLayout` had to pay for the reachability argument before it could decline to
copy the dead limb. A comment now names the invariant in place so the arm is not re-added.
