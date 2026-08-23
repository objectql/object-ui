---
'@object-ui/components': minor
---

Retire `ActionParamDialog`: the `custom` barrel's second action-param dialog is
removed, and the app-shell dialog is recorded as the surviving implementation
(objectui#5685, maintainer ruling of 2026-08-22).

**Breaking for any out-of-repo host that imported it** (declared `minor` per the
repo's version-alignment rule — the major tracks `@objectstack`, never an
API-break count): `@object-ui/components` no longer exports `ActionParamDialog`
or `ActionParamDialogProps`. Measured at the branch point, the export had zero
production consumers — its only in-repo importers were its own five test files,
which retire with it, and no other repository in the organization imports the
symbol from this package.

This file was the repo's SECOND implementation of the action-param surface, and
its audit trail is the reason it retires instead of being maintained: the last
close look (objectui#4758) found per-option `visibleWhen` not evaluated at all,
and the five hardcoded English strings this card originally recorded were the
next drift installment. A dormant second dialect of a governed surface is one
production import away from being live; removing it removes the whole drift
class.

FROM → TO for an out-of-repo host:

- `import { ActionParamDialog } from '@object-ui/components'` — no drop-in
  replacement is published. The surviving implementation is
  `@object-ui/app-shell`'s `ActionParamDialog` (`src/views/ActionParamDialog.tsx`),
  rendered by app-shell's action runtime (`useConsoleActionRuntime`,
  `RecordDetailView`) rather than exported standalone. A host that needs its own
  param form builds on `@object-ui/fields`' shared field widgets
  (`resolveFormWidgetType` / `getLazyFieldWidget`, ADR-0059) — the same seam the
  surviving dialog renders through.

The unreleased objectui#4758 changeset for this component (`select` options
through the shared option evaluator) is withdrawn in the same change: the
component retires before that fix ever ships, so the release notes carry the
removal rather than new behaviour of a surface this release does not contain.
