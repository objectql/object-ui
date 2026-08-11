---
'@object-ui/plugin-list': patch
'@object-ui/i18n': patch
---

List sort: the relational hint stops recommending a formula field, the one type the server refuses to sort by

The Sort panel withholds columns that link to another record and explains why, and the last sentence of that explanation named the remedy: *add a formula field holding it*. A formula field is exactly what the platform will not order by. The server keeps `UNMATERIALIZED_SORT_TYPES = new Set(['formula'])` and, since objectstack#6994, a sort naming one is a hard `400 INVALID_SORT` — before that it degraded silently, returning every row with `asc` and `desc` byte-identical. So an author who read the hint, followed it, and built a formula field arrived at a refusal; and since #4243 withheld formula fields from this very picker, at a field the panel does not offer either. Two doors, opposite advice, for one problem.

The remedy sentence now names a **stored, denormalised field — written when the source changes** — and rules the formula field out in as many words: it is virtual, no column is stored for it, and the server refuses to sort by one. That is deliberately the server's own vocabulary rather than a third phrasing of the same fact: objectstack#6924 and objectstack#6994 settled on one wording across the refusal doors so an author refused twice is not sent two different ways, and this is the UI door of that same set. The first half of the hint — why relation columns are withheld at all — is unchanged.

All ten locale packs move together, as `check:i18n-drift` requires of any `en` edit. The same sentence also lives in `plugin-list`'s provider-less fallback table, which is what renders when the component is used outside an `I18nProvider`; it is updated to match `en` byte for byte, because a pack-only reword would have left the retired advice on exactly the surface this fixes.
