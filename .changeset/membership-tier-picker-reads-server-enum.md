---
'@object-ui/app-shell': patch
---

The approver membership-tier picker offers the tiers the server accepts, and a stored `delegated_admin` is no longer labelled "(invalid)".

The strict select for `org_membership_level` approvers carried a hand-spelled
`owner` / `admin` / `member` array, under a comment attributing the set to
better-auth. ADR-0105 D8 added `delegated_admin` to `sys_member.role`, and the
copy went stale in both directions at once: the tier could not be picked, and a
legitimately-saved `{ type: 'org_membership_level', value: 'delegated_admin' }`
approver rendered as `delegated_admin (invalid)` — a spec-valid,
runtime-resolvable value labelled invalid to the author's face.

The picker now prefers the server-published enum (`xRef.sources[...]`, carried
through by `json-schema-to-fields`) and uses it verbatim, order included — the
same precedence rule this file already applies to record lookups, and the only
one that cannot drift from what the engine accepts. A tier the local pin has
never heard of renders as a humanized choice rather than a raw token, so the
next vocabulary addition reaches authors without an objectui release.

The local list survives only as the fallback for a server predating the
annotation, and is now DERIVED from the spec's `BUILTIN_MEMBERSHIP_ROLE_OPTIONS`
— which that package documents as "the picker's vocabulary" and ships with
labels — so it is no longer a second source of truth that can go stale. A
published-but-empty enum falls back rather than rendering an empty strict
select, which would trap the author with no way to express a value at all.

`(invalid)` keeps its meaning: a value outside the vocabulary the server
actually published is still flagged.
