---
'@object-ui/app-shell': patch
---

The metadata-admin permission matrix no longer authors the retired object-permission
bits `allowRestore` / `allowPurge` (objectui#6595).

The `Re` and `Pu` columns, their two typed fields, the two preview rows, and the
"Purge (hard delete) granted without Delete" sanity check are gone, together with the
two column tooltips in both locale tables. `allowTransfer` is enforced upstream
(objectstack#3004) and is untouched — it stays a column.

Both removed keys gated `restore` / `purge` ObjectQL operations that **have never
existed**: a dispatched restore/purge is denied unconditionally by the evaluator's
fail-closed destructive-operation backstop. So every tick of those checkboxes wrote a
grant no runtime has ever read, and the preview lint warned about a combination whose
danger was entirely notional. `@objectstack/spec` retired both keys as `retiredKey()`
tombstones (objectstack#12497; maintainer ruling 2026-08-26 accepting objectstack#1883
recommendation B, ADR-0049 enforce-or-remove), which turns the same checkbox into a save
that hard-fails at publish once the bump carrying that retirement reaches this repo.

**The return path is named in the code, not just here**: both keys come back with the M2
lifecycle initiative, whose restart is recorded upstream on objectstack#1883. The
tombstone on `ObjectPerm` in `permission-slice.ts` states it, and the two `retiredLifecycleKeys`
pins name it again — a future reader who wonders where the columns went finds the answer
at each of the three sites the removal touched.

**A stored legacy value is carried through, not stripped.** It is no longer modelled and
no longer authorable, so it rides through save untouched exactly as any key this editor
does not model does — the record-level index signature on `PermissionSetDraft` states
that rule, and `updateObjectPerm`'s spread applies it per row. Stripping was deliberately
left out: the installed `@objectstack/spec` (17.2.0, measured 2026-08-27) still **accepts**
both keys at permission parse, so a strip today would delete stored data the schema still
honours. Once the bump lands and a carried value becomes a body the schema refuses,
strip-on-load becomes correct — that is objectui#4644's resolution for `indexed`, and it
belongs to the bump PR. The pin that records today's posture says so in its own header,
so the bump replaces it deliberately rather than deleting a red.
