---
---

The Studio Data pillar's grid slot (`renderStudioGridList`) drops the leftover `refreshKey` parameter and pins the refresh channel it actually rides (#4549).

No behaviour change, so nothing is released by this. The parameter was already unread — #4528 removed the dead forward to `ListView`, which declares no such prop. What was measured under #4549 is that the pillar was never missing its post-mutation refresh at all: the plugin ObjectView emits the same counter twice, and the live one, `schema.refreshTrigger`, rides this slot's schema spread into `ListView`'s fetch effect. New tests pin that channel (severing it turns them red) and pin that it keys off the signal VALUE rather than renders. `@object-ui/app-shell`'s public `index.d.ts` is byte-identical before and after.
