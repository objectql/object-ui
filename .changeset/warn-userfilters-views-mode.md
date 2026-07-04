---
'@object-ui/app-shell': patch
---

Warn when `userFilters` / `quickFilters` on an object list view are
suppressed instead of dropping them silently (#2219).

ADR-0053 correctly reserves those fields for page lists (InterfaceListPage
"filters" mode) and suppresses them on the object default list, but until the
phase-4 schema guardrail lands the author got zero signal — a valid schema
and a toolbar with nothing where the filter controls should be. ObjectView
now logs a one-shot warning per object/view naming the offending fields and
where they belong.
