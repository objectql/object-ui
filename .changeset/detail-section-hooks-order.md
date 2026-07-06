---
'@object-ui/plugin-detail': patch
---

Fix a React #300 crash when drilling from a master record into a related child record.

`DetailSection` placed its all-empty `return null` guard *before* the virtual-scroll `useEffect`, so a section that rendered all-empty on one pass (effect skipped) and populated on the next (effect runs) changed its hook count between renders of the same reconciled fiber — React threw error #300 ("rendered more hooks than during the previous render"). This reliably tripped on the master-detail drill-in (e.g. Account → Project), showing an error boundary and bouncing the user away on refresh. The all-empty guard now runs after every hook, making the hook count invariant.
