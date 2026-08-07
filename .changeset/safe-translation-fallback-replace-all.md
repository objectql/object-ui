---
"@object-ui/i18n": patch
---

`createSafeTranslation`'s no-provider fallback interpolation now replaces **all**
occurrences of each placeholder, matching i18next semantics on the provider path.

The fallback used `value.replace('{{k}}', String(v))`, and `String.prototype.replace`
with a string needle substitutes only the *first* match. A default string repeating a
placeholder — `'Selected {{count}} of {{count}} items'`, natural in many locales and
sometimes required by RTL / agglutinative word order — therefore leaked literal braces
to users on hosts with no `I18nProvider` mounted (standalone / embedded renderers),
while the same string interpolated correctly once a provider was present. A silent
semantic fork, in exactly the environments we observe least.

The replacement is `value.split(needle).join(String(v))` rather than `replaceAll`:
both `replace` and `replaceAll` interpret `$&`, `` $` ``, `$'` and `$$` in the
*replacement* string, which i18next does not. Values here are runtime data (record
labels, search terms), so that second divergence was reachable today — a label
containing `$&` was mangled on the fallback path. split/join is literal on both sides
and needs no regex escaping of the placeholder name.

Key resolution (`defaults[key] || key`), the `String(v)` coercion, and the
leave-it-literal behaviour for a placeholder with no matching option are unchanged.
Fixes objectui#3418.
