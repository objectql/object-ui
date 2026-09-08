---
---

Both objectui#7448 document-count pins now read their workflow header through
the same extraction the third copy uses: the leading `#` marker is stripped
before the pattern runs, so a count that wraps across two comment lines is no
longer invisible to them (objectui#7967). The pattern itself is unchanged,
byte-identical across all three copies. A positive control demonstrating the
wrapped-count catch is committed in each pin. Test only; no package is released
by this change.
