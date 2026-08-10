---
"@object-ui/i18n": patch
---

Backfill the last 17 missing locale keys and both remaining template-key families, emptying the call-site key ratchet (objectui#3546, slice seven — final)

`scripts/check-i18n-call-site-keys.mjs` (objectui#3530) opened this backlog with
**258 keys and 4 template-key families** that a `t()` call site asks for and that
**no locale pack defined**. Seven slices later the last of it is paid: this change
takes the ratchet from 17 keys to **zero** and from 2 prefix families to **zero**,
and the gate now reports every one of the **2320** literal call-site keys
resolving against `en`.

The residue was the long tail — nine namespaces across `app-shell`,
`plugin-detail`, `plugin-dashboard`, `plugin-kanban` and `plugin-gantt`, none of
them big enough to have been its own slice. 17 distinct keys at **23** call sites
(five keys are used at more than one site) plus **3** call sites behind the two
families.

What that meant on the page for a `zh` (or `ja`, `de`, `ar`, …) user: the "App not
available" empty state a user lands on when an app is still publishing, including
its whole explanation and its Retry button; the interface page's "source is not
available" message; the system navigation's **Administration** group header,
**Datasources** and **Documentation** entries; the "creating new organizations is
disabled on this instance" guard in the workspace dialog; the invitation list's
five status labels (All / Pending / Accepted / Rejected / Canceled) on both the
filter tabs and every invitation badge; the Gantt dependency-drag hint that names
which endpoint the drop will link (`start` / `end`); the record detail's Add,
"Record deleted", "No history yet" and the concurrent-update dialog's "this
record"; the kanban empty board's column count; the dashboard widget's screen
reader "Loading…"; and the page editor's "Edit in studio" tooltip and accessible
name. All of it rendered English, in every one of the ten languages.

Nothing here rendered a raw key — slice one (PR #3583) held those sites, and the
three keys the issue body named as unprotected (`detail.viewSource`,
`wizard.missingRequired`, `gantt.toolbar.refresh`) have resolved in `en` since.

Both families are repaired as **enumerations, not wildcards**, and the assertion
that used to live in the ratchet's `missingPrefixes` moves into a test that fails
if either union grows a member without a key:

- `gantt.linkEnd.` — the closed union `'start' | 'end'`, declared by GanttView's
  own `linkDrag` state.
- `organization.invitations.status.` — `StatusFilter`
  (`all | pending | accepted | rejected | canceled`), declared by InvitationsPage.

Every `en` value is byte-identical to the English the call site rendered before,
so no string a user sees today changes: 16 keys match an inline
`t(key, { defaultValue: … })`; `dashboard.loading` matches `useSafeTranslate`'s
positional fallback `tt(key, 'Loading…')`; `gantt.linkEnd.*` match
`useGanttTranslation`'s per-key fallback map; and the five status labels match the
CSS-capitalised wire value each badge and tab showed. The nine translations follow
each pack's own neighbourhood and reuse an existing neighbour's row wherever the
`en` string already existed verbatim **and** that row is grammatical here — the
four invitation adjectives are deliberately not reused from the approvals family,
because those agree with each pack's word for "request" (`ru` masculine `Отклонён`)
while an invitation needs its own agreement (`ru` neuter `Отклонено`).

`scripts/i18n-call-site-key-baseline.json` is kept rather than deleted: empty is
its terminal, load-bearing state — against an empty baseline any NEW unresolved
call-site key is unexpected and fails the build.

No component changed.
