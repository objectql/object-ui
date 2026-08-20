---
'@object-ui/app-shell': minor
'@object-ui/i18n': minor
---

The approval panel identifies the pending approver by name, not by a truncated raw id.

A record waiting on a position rendered its approver as `positi…ager` — the
engine reference `position:sales_manager`, 22 characters, past the identity
formatter's 14-character truncation arm and middle-truncated to fit its chip. The
step names beside it were human prose; the one line answering *who is holding
this record* was an internal identifier, and not even a complete one. The same
reference reached the admin-override confirm dialog un-truncated, so a paragraph
of plain governance prose ended `— position:sales_manager` (objectui#5414).

Both surfaces now resolve the reference before rendering, in three tiers, most
authoritative first. The server's own `pending_approver_names` wins whenever it
answers, and a backend that resolves its own slate costs the record page no extra
request. Otherwise the console reads the directory row the spec's approver
binding names — `sys_position.label` gives `Sales Manager` / `销售经理` — and,
for a position, who fills the seat (`Sales Manager · Zhang Wei, Li Na`). With no
adapter and no row, the machine name still prettifies into prose rather than
truncating. The raw reference stays on hover, which is where an internal
identifier belongs.

An unstaffed position is surfaced rather than hidden: `销售经理（暂无在岗人员）`
is actionable where `positi…ager` is not, and it is the motivating rescue case
for the admin-override path. Staffing is deliberately tri-state — a
`sys_user_position` read the viewer is not permitted to make leaves the seat's
staffing UNKNOWN and says nothing, because "I could not look" is a different
claim from "nobody holds it" and only one of them is safe to print on a
governance surface.

Two locale keys are added across all ten packs: `approvalsInbox.approverUnstaffed`
and `approvalsInbox.approverNameSeparator`. The separator is a translated
punctuation key rather than `Intl.ListFormat`, which was measured on this tree
joining `['张伟','李娜']` into `张伟李娜` for `zh` — two names run together with
no separator, reading as one person's name.

The directory-backed kinds and their value columns are read from
`@objectstack/spec`'s `APPROVER_VALUE_SOURCES` rather than restated, so a new
approver type is covered the day the spec publishes it. Id-valued kinds
(`user` / `team` / `department`) keep the existing middle-truncation: a row id
has no prose to recover, and that arm is objectui#3461's answer, not this card's
defect.
