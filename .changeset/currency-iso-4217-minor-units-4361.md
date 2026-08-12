---
'@object-ui/fields': patch
---

Currency amounts now follow each currency's own ISO 4217 fraction-digit
convention instead of a hardcoded 2 (objectui#4361).

Both currency formatting paths in `@object-ui/fields` picked a fraction-digit
width and handed it to `Intl.NumberFormat`, which OVERRIDES the digit count
`Intl` already knows for the currency being rendered. `formatCurrency` derived
its width from the VALUE's wholeness alone (`isWhole ? 0 : 2` — a literal 2 for
every currency on earth), and `CurrencyField` defaulted an undeclared
`precision` to the same literal. So a yen amount was printed with cents the
currency does not have and a dinar amount with one digit fewer than it does:

| | before | after |
| --- | --- | --- |
| JPY `1234.5` | `¥1,234.50` | `¥1,235` |
| KWD `1.5` | `KWD 1.50` | `KWD 1.500` |
| CLP `1234.5` | `CLP 1,234.50` | `CLP 1,235` |
| BHD `2.5` | `BHD 2.50` | `BHD 2.500` |
| USD `1234.5` | `$1,234.50` | `$1,234.50` |
| USD `1234` | `$1,234` | `$1,234` |

Both call sites now derive the width from the currency itself
(`Intl.NumberFormat(undefined, { style: 'currency', currency })
.resolvedOptions().maximumFractionDigits`, memoized per code) and switch
wholeness against THAT.

**The whole-number convention is extended, not retired.** Simply dropping both
bounds and letting `Intl` decide would have fixed the digit count while turning
`$1,234` back into `$1,234.00` — the Salesforce convention `formatCurrency`
documents and objectui#4033 pinned. A whole amount still drops the fraction, now
for every currency: `KWD 1` renders `KWD 1`, not `KWD 1.000`. Two-decimal
currencies are byte-identical to before, which is why the objectui#4033 and
objectui#4332 pins pass unchanged.

**On `CurrencyField`, an explicitly authored `precision` still wins** — it is
authored metadata and authored metadata keeps priority, so a JPY field declaring
`precision: 2` still renders `¥1,234.50`. Only an ABSENT `precision` derives from
the currency; because that derivation is the widget's one precision, it also
reaches the spinner `step` and the blur rounding, so a JPY field no longer offers
a `0.01` step for a currency with no minor unit. Whether a declared `precision`
that contradicts the currency's ISO 4217 digits should be REJECTED at publish
time is a contract question, filed upstream in `@objectstack/spec` rather than
answered here by overriding the author.

Reachable wherever the resolved currency is not a 2-decimal one — the field's
`currency`, `currencyConfig.defaultCurrency`, or the tenant default (ADR-0053).
