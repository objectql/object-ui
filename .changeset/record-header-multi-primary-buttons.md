---
"@object-ui/components": minor
"@object-ui/app-shell": minor
---

feat(page-header): metadata-driven multi-button record header (#2361)

The record detail page header no longer hardcodes a single inline primary
button (`INLINE_MAX = 1`). It now renders up to `maxVisible` actions
side-by-side (default 3 desktop / 1 mobile, overridable via
`maxVisible` / `mobileMaxVisible` on the `page:header` schema) — the same
contract as `action:bar` — so multi-action objects (e.g. Lead: Convert /
Assign / Return) can surface several primary buttons at once.

Which actions claim the inline slots is declared in metadata, mirroring the
`action:bar` #2339 rules:

- `order` ascending (unset = 0; lower = more prominent), stable sort;
- `variant: 'primary'` as a tie-break within equal order (also mapped to the
  Shadcn `default` Button variant instead of leaking through);
- `component: 'action:menu'` pins an action inside the `⋯` overflow menu
  regardless of the action count.

The synthesized system actions declare their placement accordingly:
`sys_edit` gets `order: 100` (behind every authored business action, but
still inline when slots remain), while `sys_share` / `sys_delete` are pinned
into the `⋯` menu via `component: 'action:menu'` — Delete never surfaces as
an inline red button just because an object has few actions.
