---
'@object-ui/app-shell': patch
---

Flow builder (#1934): expression problems — ADR-0032 brace/shape errors and scope-aware "unknown reference" warnings — now also surface in the flow **Problems panel** and as on-canvas **node/edge badges** (#1972), not just inline in the inspector. A `{record.x}` brace-in-CEL mistake or a typo'd variable is now visible at the flow level without opening each node. The start node's bare trigger-record fields are excluded from the ref check to avoid false positives (the inline inspector check still covers them).
