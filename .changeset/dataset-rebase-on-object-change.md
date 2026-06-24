---
"@object-ui/app-shell": patch
---

fix(metadata-admin): re-base a dataset when its base object changes

A dataset's joins (`include`), dimensions, measures, and filter all reference the
base object's fields. Changing the base object left those referencing the OLD
object — stale field refs that silently produce broken/ambiguous queries. Now a
real object change clears the object-dependent config (selecting the same object
is a no-op), and a heads-up note appears while there is config that a change would
clear. Found by dogfooding (G1).
