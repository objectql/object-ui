/**
 * Resolve a possibly-localized value to the best string for a language.
 *
 * Accepts a plain string (passed through) or an i18n object keyed by language
 * code — e.g. `{ en: 'Pricing', 'zh-CN': '定价', zh: '定价', default: 'Pricing' }`.
 * Resolution order: exact language -> base language (`zh-CN` -> `zh`) -> any
 * region-qualified key sharing the base (`zh` -> `zh-CN`) -> `default` -> `en`
 * -> first value. Unlike a `default`/`en`-only resolver this is genuinely
 * locale-aware, so server-driven metadata (page text, action param labels) can
 * carry inline translations instead of rendering "[object Object]" or English.
 *
 * Pure — pair it with `useObjectTranslation().language` (or any current-locale
 * source) at the call site.
 *
 * Every limb reads **own properties only** and accepts **only `string` values**
 * (objectui#3907). Both guards used to hold on the regional and last-resort
 * limbs alone, which left the other four able to resolve a locale against
 * `Object.prototype` — `pickLocalized({ en: 'Pricing' }, 'constructor')`
 * rendered the constructor's source text as the label — and able to
 * short-circuit the chain with a non-string value, rendering `[object Object]`.
 * Neither is reachable by an input the contract admits (no BCP-47 tag is an
 * `Object.prototype` member, and `InlineLocaleMapSchema` is
 * `z.record(<tag>, z.string())`), so applying them uniformly changes nothing
 * for any real language tag. It makes this function agree limb for limb with
 * the backend twin `resolveI18nLabel` (`@objectstack/spec`, objectstack#6765),
 * whose locale can arrive from an untrusted `Accept-Language` header and which
 * shipped with exactly these two narrowings recorded as deliberate departures.
 * The only remaining difference between the two is how each spells a miss —
 * `''` here for a text node, `undefined` there for a producer's `?? name` chain
 * — pinned in `plugin-list/src/__tests__/i18nLabel-resolver-parity.test.ts`.
 *
 * A guard makes its limb **miss**; it never aborts the resolution. An unusable
 * entry falls through to the next limb exactly as an absent one does, so
 * `pickLocalized({ en: 'Pricing' }, 'constructor')` is `'Pricing'`, not `''`.
 */
export function pickLocalized(value: unknown, language: string | undefined | null): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    /**
     * One entry, or `undefined` when this limb does not hit — which is what
     * lets the limbs keep chaining through `??` in the same order as before.
     */
    const read = (key: string): string | undefined => {
      if (!Object.prototype.hasOwnProperty.call(o, key)) return undefined;
      const entry = o[key];
      return typeof entry === 'string' ? entry : undefined;
    };
    const lang = (language || 'en').trim();
    const base = lang.split('-')[0];
    // Runtime language is often a bare base code ('zh') while metadata authors
    // write full BCP-47 tags ('zh-CN') — upgrade to any key sharing the base.
    // `Object.keys` is already own-and-enumerable, so `read` here is uniformity
    // rather than a second guard.
    const regional = Object.keys(o).find((k) => k.split('-')[0] === base && read(k) !== undefined);
    const pick =
      read(lang) ??
      read(base) ??
      (regional !== undefined ? read(regional) : undefined) ??
      read('default') ??
      read('en') ??
      Object.values(o).find((v): v is string => typeof v === 'string');
    return pick == null ? '' : pick;
  }
  return String(value);
}
