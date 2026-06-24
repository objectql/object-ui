---
'@object-ui/app-shell': patch
---

Flow builder data-picker follow-ups (#1934): (1) a scope-aware "unknown reference" warning pairs the picker with inline validation — a typed reference whose root isn't in scope at the node is flagged with a nearest-match "did you mean?" hint (conservative: root-only, skips function calls / string literals / runtime globals; non-blocking amber). (2) Assignment values authored in the array form `[{ variable, value }]` now render in the key/value editor (and get the picker) instead of falling back to Advanced JSON; the editor reads both the object-map and array shapes and preserves whichever was authored. (3) A script `code` body (JS/TS, not a `{var}` template) now inserts bare references via a `refMode` field override — `{x}` is a syntax error in a script.
