/**
 * objectui#3878 — the ten packs wrote the ellipsis two ways at once. `en` ended
 * 33 values with three ASCII full stops (`Loading...`) and 110 with the
 * typographic ellipsis U+2026 (`Loading…`), and the nine translation packs
 * copied `en` value by value, so the split propagated rather than being a
 * translation habit.
 *
 * It is **same-screen visible**, which is why it is a defect and not a taste:
 * `console.ai.askAnything` (`Ask anything...`) sits in the AI panel beside
 * sibling values that already used `…`, and `common.loading` (`Loading...`)
 * renders on the same dashboard as `dashboard.loading` (`Loading…`).
 *
 * ## The ruling
 *
 * Converge on **U+2026 `…`**, per the maintainer-authorized consistency pass
 * registered on objectstack#6015 (2026-08-09): typographic ellipsis for
 * user-facing copy. `…` was already the 110:33 majority in `en` and the
 * typographically correct form, so the minority moved.
 *
 * ## Why the invariant is "no ASCII `...` in ANY value of ANY pack"
 *
 * The card asked for "a trailing ASCII `...` in an `en` value errors". The scan
 * below is deliberately wider on both axes, because the census taken at landing
 * showed the narrow version would have shipped with holes in it:
 *
 *   - **Not trailing-only.** `collaboration.commentPlaceholder` is
 *     `Add a comment… (use @ to mention)` — the ellipsis is mid-sentence, and
 *     all nine packs already wrote it as `…` while `en` alone wrote `...`. A
 *     trailing-only rule cannot see that value at all, and it renders in the
 *     same composer as `collaboration.replyingTo`, which the same pass moved.
 *   - **Not en-only.** `list.loading` was the mirror image: `en` already said
 *     `Carregando…`-style `…` while all nine packs still said `...`. `en` never
 *     changed, so `check-i18n-en-drift.mjs` had no event to fire on and the nine
 *     were free to sit there. An `en`-only rule is blind to exactly this shape.
 *
 * The wider form also needs no per-key list to maintain: a new value arriving
 * with a typewriter ellipsis fails by key name without anyone editing this file.
 * That is the same reasoning, and the same final shape, as
 * `de-quote-pairing-3876.test.ts`, whose per-key list became "no U+0022 in the
 * `de` pack at all" once the last straight quotes were gone.
 *
 * ## Why the three script gates cannot see any of this
 *
 * `all-locales-key-parity` compares key sets and placeholder shapes,
 * `check-i18n-call-site-keys.mjs` asks only whether a key resolves, and
 * `check-i18n-en-drift.mjs` fires on an **`en` value change** — these values were
 * split from the day they landed, so for most of them no drift event ever
 * existed. All three are value-blind by design, which is why the convention has
 * to be pinned in a test.
 *
 * ## What this file does NOT cover, deliberately
 *
 * The per-package **no-provider fallback tables** hold their own English copies
 * of some of these keys (`packages/collaboration/src/useCollaborationTranslation.ts`,
 * `packages/fields/src/widgets/useFieldTranslation.ts`,
 * `packages/plugin-detail/src/useDetailTranslation.ts` and others), and they
 * still spell the ellipsis in ASCII. Those copies render only when no
 * `LocalizationProvider` is mounted; converging them is a separate surface with
 * its own in-flight owners, filed separately rather than smuggled in here. This
 * scan is scoped to the ten packs and says so, so the next reader does not read
 * its green as a claim about those tables.
 */
import { describe, expect, it } from 'vitest';

import { builtInLocales } from '../locales/index';

/** … U+2026, the one spelling. */
const ELLIPSIS = '…';
/** The typewriter spelling this pass retired: three ASCII full stops. */
const ASCII_ELLIPSIS = '...';

const LANGS = ['en', 'zh', 'ja', 'ko', 'de', 'fr', 'es', 'pt', 'ru', 'ar'] as const;
type Lang = (typeof LANGS)[number];

/** Every string leaf of a pack, as `[dotted.path, value]`. */
function flatten(pack: unknown, prefix = ''): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(pack as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.push([path, v]);
    else if (v && typeof v === 'object') out.push(...flatten(v, path));
  }
  return out;
}

const PACKS: Record<Lang, Array<[string, string]>> = Object.fromEntries(
  LANGS.map((lang) => [lang, flatten(builtInLocales[lang])]),
) as Record<Lang, Array<[string, string]>>;

/**
 * The 35 keys this pass converged: every key that held an ASCII ellipsis in at
 * least one of the ten packs on the commit before the fix. Pinned by name so the
 * scan below cannot go green by the keys quietly disappearing, and so the census
 * is readable next to the rule rather than only in the PR that made it.
 *
 * 312 pack values changed in all: 34 in `en` (33 trailing + the one mid-sentence
 * `collaboration.commentPlaceholder`) and 278 across the nine.
 */
const CONVERGED_KEYS = [
  'appManagement.searchPlaceholder',
  'auth.forgotPassword.submittingButton',
  'auth.login.submittingButton',
  'auth.register.submittingButton',
  'chart.loading',
  'collaboration.commentPlaceholder',
  'collaboration.replyingTo',
  'collaboration.replyingToComment',
  'common.loading',
  'common.select',
  'console.ai.askAgent',
  'console.ai.askAnything',
  'console.ai.loadingAgents',
  'console.ai.loadingHistory',
  'console.ai.searchChats',
  'console.commandPalette.placeholder',
  'console.initializing',
  'console.objectView.searchFields',
  'console.objectView.selectField',
  'console.objectView.selectOption',
  'console.objectView.ufAddField',
  'detail.filterPlaceholder',
  'detail.loading',
  'fields.richText.placeholder',
  'grid.loading',
  'home.loading',
  'kanban.cardTitlePlaceholder',
  'list.loading',
  'search.placeholder',
  'sidebar.searchNavigation',
  'table.search',
  'topbar.connection.connecting',
  'topbar.connection.reconnecting',
  'workflow.fromPlaceholder',
  'workflow.toPlaceholder',
] as const;

describe('objectui#3878 — the ten packs spell the ellipsis U+2026 and only U+2026', () => {
  it('holds no ASCII "..." in any value of any pack', () => {
    // Non-vacuity first: an empty or collapsed pack would satisfy every
    // assertion below while checking nothing, which is the failure mode the
    // whole i18n gate family exists to avoid.
    for (const lang of LANGS) {
      expect(PACKS[lang].length, `${lang} pack collapsed`).toBeGreaterThan(2000);
    }

    const offenders: string[] = [];
    for (const lang of LANGS) {
      for (const [key, value] of PACKS[lang]) {
        if (value.includes(ASCII_ELLIPSIS)) offenders.push(`${lang} ${key}: ${JSON.stringify(value)}`);
      }
    }
    // Named, not counted: a regression has to say which value regrew, and the
    // message has to tell the next author what to write instead.
    expect(
      offenders,
      `Write the ellipsis as ${ELLIPSIS} (U+2026), not as three ASCII full stops — ` +
        'objectui#3878, per the consistency pass on objectstack#6015. ' +
        `${offenders.length} value(s) still use the typewriter form.`,
    ).toEqual([]);
  });

  it('keeps an ellipsis in every pack for each of the 35 keys this pass converged', () => {
    // The complement of the rule above. Without it, deleting the ellipsis
    // outright would pass the ASCII scan — green because nothing is produced,
    // which is not the same fact as green because the copy is right.
    expect(CONVERGED_KEYS).toHaveLength(35);

    const missing: string[] = [];
    for (const lang of LANGS) {
      const byKey = new Map(PACKS[lang]);
      for (const key of CONVERGED_KEYS) {
        const value = byKey.get(key);
        // Every one of the 35 is defined in all ten packs; an absent key is a
        // key-set fact owned by all-locales-key-parity, and reporting it as
        // "no ellipsis" here would send the reader to the wrong gate.
        expect(typeof value, `${lang} ${key} missing`).toBe('string');
        if (!(value as string).includes(ELLIPSIS)) missing.push(`${lang} ${key}`);
      }
    }
    expect(missing, 'these values lost the ellipsis entirely rather than converging on U+2026').toEqual([]);
  });

  it('pins the four keys where en was the sole outlier, because they are the drift waivers', () => {
    // On these four, the nine packs were ALREADY correct and only `en` moved, so
    // `check-i18n-en-drift.mjs` sees an `en` change that no pack follows — the
    // one honest use of its waiver ledger. `scripts/i18n-en-drift-baseline.json`
    // carries them, and the ledger re-checks each transcribed sentence against
    // `en` on every run, so an `en` edit here fails the build until the waiver is
    // renewed or dropped. Pinning the sentences here too means the pair cannot
    // drift apart silently.
    expect(builtInLocales.en.appManagement.searchPlaceholder).toBe('Search apps…');
    expect(builtInLocales.en.collaboration.replyingTo).toBe('Replying to {{name}}…');
    expect(builtInLocales.en.collaboration.replyingToComment).toBe('Replying to comment…');
    expect(builtInLocales.en.collaboration.commentPlaceholder).toBe('Add a comment… (use @ to mention)');
  });

  it('leaves the interpolation placeholders untouched', () => {
    // The transform ran over value text, so `{{name}}`/`{{agent}}` were never in
    // its reach — asserted rather than assumed, since a value-rewriting sweep
    // that ate a placeholder would still pass every check above.
    expect(builtInLocales.en.console.ai.askAgent).toBe('Ask {{agent}}…');
    for (const lang of LANGS) {
      const byKey = new Map(PACKS[lang]);
      expect(byKey.get('console.ai.askAgent'), `${lang} askAgent placeholder`).toContain('{{agent}}');
      expect(byKey.get('collaboration.replyingTo'), `${lang} replyingTo placeholder`).toContain('{{name}}');
    }
  });
});
