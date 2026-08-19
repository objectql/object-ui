---
---

Comment-only: `MasterDetailField` (`packages/fields/src/widgets/MasterDetailField.tsx`)
gains a header tombstone recording that it is absent from `fieldWidgetMap`, unreachable
from any form path (`master_detail` deliberately resolves to `LookupField`), and that its
only in-repo consumer is its own test — so future `widgets/**` audits (the #3291 / #3318 /
#4788 class) skip this file instead of re-discovering and re-investigating it each time
(objectui#4811). No behaviour, export, or public API changes.
