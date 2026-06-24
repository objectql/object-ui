---
'@object-ui/app-shell': patch
---

Flow builder data-picker (#1934): the cursor-insertion math is extracted into a pure `insertToken` helper with unit tests (alongside `formatToken`) — bare CEL vs `{var}` template insertion, append / mid-string / selection-replace, and clamping a reversed or out-of-range selection. Pure refactor, no behavior change.
