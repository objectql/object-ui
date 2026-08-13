---
'@object-ui/plugin-gantt': patch
---

Gantt tooltip currency re-formats when the tenant currency resolves
(objectui#4542).

ObjectGantt's `tasks` memo builds every tooltip string eagerly inside its
callback, and the `'currency'` case resolves its code down to the tenant
default (`resolveFieldCurrency(def, tenantCurrency)`). `tenantCurrency` was
not in the memo's dependency array, so the value was read but never watched.

That default comes from `GET /api/v1/auth/me/localization`, which is cosmetic
and non-blocking and therefore answers AFTER first paint. The context change
re-rendered ObjectGantt, but with none of `data` / `ganttConfig` /
`objectSchema` / `displayLocale` changed the memo handed back its cached task
array — so a tooltip amount kept the pre-resolution rendering (a plain
`1,234.50` instead of `€1,234.50`) until something unrelated invalidated the
memo.

This is the currency twin of objectui#4272, which added `displayLocale` to
this same array for the same reason, and it is not covered by that dep: the
producer writes currency and locale from one response, so a tenant that
configures BOTH re-runs the memo through the locale channel — but a tenant
that configures a currency and no locale (the common shape, since the tenant
locale is frequently unset) leaves `displayLocale` untouched and the currency
stale.

Module-local: the fix is one dependency, the package's `.d.ts` files are
byte-identical, and rendering is unchanged whenever the channel resolves
before first paint or a field carries its own currency code.
