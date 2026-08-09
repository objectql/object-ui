/**
 * objectui#3876 — the `de` pack paired the German **opening** quote
 * `„` („, low-9) with an **ASCII straight quote** `"` (") as its
 * closer, so German users read a typewriter quote where the typography of the
 * rest of the pack (and of German orthography, DUDEN R11) puts `“` (“).
 *
 * ## Census taken at landing (main@2937bcf7d), not inherited
 *
 * The card said "20 values"; the triage re-scan on an earlier main said "22
 * mismatched pairs". **Both are right about different units** and this file
 * exists partly to stop that ambiguity from recurring:
 *
 *   - **20 keys** carried a mismatch, and
 *   - **22 mismatch occurrences** lived in them — `navigationSync.renamedPage`
 *     and `navigationSync.renamedDashboard` each quote *two* names in one
 *     sentence ("Seite „alt“ in „neu“ umbenannt"), so they contribute two each.
 *
 * Full-file counts, before → after: `„` 45 → 45, `“` 25 → 47,
 * `”` 2 → 2, `"` 28 → 6.
 *
 * ## Why the invariant is NOT `count(„) === count(“)`
 *
 * The card proposed that assertion. It is **false on the correctly fixed file**
 * (45 vs 47) and would have sent the next reader hunting a bug that isn't
 * there. Two values in this pack are still untranslated English prose and quote
 * in the *English* style — `“…”`:
 *
 *   - `grid.import.savedMappingHint`
 *   - `grid.import.savedMappingPreviewNote`
 *
 * Their two `“` are legitimate **openers**, not German closers, which is
 * the whole 45/47 gap. The durable form that survives both this fix and a later
 * translation of those two values is
 *
 *     count(“) === count(„) + count(”)
 *
 * — every German `„` is closed by a `“`, and every *extra* `“` is
 * an English opener answered by a `”`. Germanising those two values keeps
 * it true (47 === 47 + 0); re-introducing one mismatch breaks it (46 !== 47).
 * The scan below is the primary check; the identity is the cheap arithmetic
 * backstop that also notices a `„` closed by nothing at all.
 *
 * ## Why the three i18n gates cannot see any of this
 *
 * `all-locales-key-parity` compares key sets and placeholder shapes,
 * `check-i18n-call-site-keys.mjs` only asks whether a key resolves, and
 * `check-i18n-en-drift.mjs` fires on **`en` value changes** — these values were
 * wrong from the day they landed, so no drift event ever existed. All three are
 * value-blind by design, which is why the invariant has to live in a test.
 */
import { describe, expect, it } from 'vitest';

import { builtInLocales } from '../locales/index';

// The four quote characters this file is about, each named next to its literal
// so a reader can tell them apart at a glance — U+201E and U+201C in particular
// are one pixel apart in most editor fonts, which is how the bug survived.
const OPEN = '„'; // „ U+201E German opening quote (low-9)
const CLOSE = '“'; // “ U+201C German closing quote
const RDQ = '”'; // ” U+201D English closing quote
const STRAIGHT = '"'; // " U+0022 ASCII straight quote
const QUOTEISH = [OPEN, CLOSE, RDQ, STRAIGHT];

const at = (pack: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((n, k) => (n as Record<string, unknown> | undefined)?.[k], pack);

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

const count = (s: string, ch: string) => [...s].filter((c) => c === ch).length;

/**
 * For every `„` in `value`, the first quote-ish character that follows it —
 * `null` when the opener is never closed. Deliberately a scanner and not a
 * `„.*"` regex: a greedy/lazy dot can hop over an intervening correct
 * closer and mis-attribute the pair.
 */
function closersOf(value: string): Array<string | null> {
  const out: Array<string | null> = [];
  for (let i = 0; i < value.length; i++) {
    if (value[i] !== OPEN) continue;
    let closer: string | null = null;
    for (let j = i + 1; j < value.length; j++) {
      if (QUOTEISH.includes(value[j])) {
        closer = value[j];
        break;
      }
    }
    out.push(closer);
  }
  return out;
}

const DE = flatten(builtInLocales.de);

/**
 * The 20 keys the fix touched, with the exact quoted span each must now carry.
 * Byte-exact on the span under test rather than on the whole sentence, so a
 * legitimate German copy edit does not have to fight this file — while any
 * change to the *quotes* still fails here by key name. Four whole values are
 * additionally pinned byte-for-byte below.
 */
const FIXED: Array<[string, string[]]> = [
  ['lookup.createNamed', ['„{{name}}“']],
  ['console.objectView.objectNotFoundDescription', ['„{{objectName}}“']],
  ['console.objectView.deleteViewConfirm', ['„{{name}}“']],
  ['console.objectView.viewTypeUnavailable', ['„{{field}}“']],
  ['console.objectView.ufShowAllRecords', ['„Alle Datensätze“']],
  ['home.gettingStarted.description', ['„Zuletzt geöffnet“']],
  ['search.resultsCount', ['„{{query}}“']],
  ['search.resultsCountPlural', ['„{{query}}“']],
  ['empty.objectNotFoundDescription', ['„{{name}}“']],
  ['empty.pageNotFoundDescription', ['„{{name}}“']],
  ['empty.dashboardNotFoundDescription', ['„{{name}}“']],
  ['empty.reportNotFoundDescription', ['„{{name}}“']],
  ['navigationSync.addedPage', ['„{{name}}“']],
  ['navigationSync.addedDashboard', ['„{{name}}“']],
  ['navigationSync.removedPage', ['„{{name}}“']],
  ['navigationSync.removedDashboard', ['„{{name}}“']],
  ['navigationSync.renamedPage', ['„{{oldName}}“', '„{{newName}}“']],
  ['navigationSync.renamedDashboard', ['„{{oldName}}“', '„{{newName}}“']],
  ['marketplace.install.localSuccess', ['„{{name}}“']],
  ['preview.empty.notReadyTitle', ['„{{app}}“']],
];

describe('objectui#3876 — de pack closes „ with “ and not with a straight quote', () => {
  it('pins the 20 fixed keys: 22 spans, each byte-exact, none holding a straight quote', () => {
    expect(FIXED).toHaveLength(20);
    expect(FIXED.reduce((n, [, spans]) => n + spans.length, 0)).toBe(22);

    for (const [key, spans] of FIXED) {
      const value = at(builtInLocales.de, key);
      // presence: a renamed or removed key must fail loudly here rather than
      // let `toContain` run against undefined and read as "nothing to check".
      expect(typeof value, `de ${key} missing`).toBe('string');
      const v = value as string;
      for (const span of spans) {
        expect(v.includes(span), `de ${key} lost the paired span ${span}`).toBe(true);
      }
      expect(count(v, OPEN), `de ${key} opener count`).toBe(spans.length);
      expect(count(v, CLOSE), `de ${key} closer count`).toBe(spans.length);
      expect(v.includes(STRAIGHT), `de ${key} still holds a straight quote`).toBe(false);
    }
  });

  it('pins the four values the issue showcased, whole and byte-for-byte', () => {
    // The sentences a German user actually reads on the empty states, the tab
    // toggle, the search header and the home hint.
    expect(at(builtInLocales.de, 'empty.pageNotFoundDescription')).toBe(
      'Die Seite „{{name}}“ wurde nicht gefunden. Sie wurde möglicherweise entfernt oder umbenannt.',
    );
    expect(at(builtInLocales.de, 'console.objectView.ufShowAllRecords')).toBe(
      'Registerkarte „Alle Datensätze“ anzeigen',
    );
    expect(at(builtInLocales.de, 'search.resultsCount')).toBe('{{count}} Ergebnis für „{{query}}“');
    expect(at(builtInLocales.de, 'home.gettingStarted.description')).toBe(
      'Markieren Sie eine App, um sie hier anzuheften und mit einem Klick darauf zuzugreifen. ' +
        'Alles, was Sie öffnen, wird automatisch unter „Zuletzt geöffnet“ angezeigt.',
    );
  });

  it('holds pack-wide: no „ in de is closed by anything but “ (the durable invariant)', () => {
    const offenders: string[] = [];
    let openers = 0;
    let paired = 0;
    for (const [key, value] of DE) {
      for (const closer of closersOf(value)) {
        openers++;
        if (closer === CLOSE) {
          paired++;
          continue;
        }
        const label =
          closer === null ? 'never closed' : `closed by U+${closer.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`;
        offenders.push(`${key}: „ ${label} — ${JSON.stringify(value)}`);
      }
    }

    // Anti-vacuous presence guard: a broken import, an emptied pack or a
    // renamed file would otherwise scan nothing and pass. Measured at landing:
    // 2914 string values, 45 openers, all 45 correctly paired.
    expect(DE.length, 'de pack looks empty — the scan would be vacuous').toBeGreaterThan(2000);
    expect(openers, 'no „ found at all — the scan would be vacuous').toBeGreaterThanOrEqual(40);
    // Offenders first: this is the assertion that names the key and shows the
    // sentence. The arithmetic below only counts, so it must not fire ahead of it.
    expect(offenders, `de values closing „ with the wrong character:\n${offenders.join('\n')}`).toEqual([]);
    expect(paired).toBe(openers);
  });

  it('holds under an independent \\p{L}-aware regex formulation (objectui#3866 lesson)', () => {
    // #3866's lesson: a census regex written with `\w`/`[A-Za-z]` silently
    // skips the umlauts and ß that German quoted spans are full of
    // ("Alle Datensätze", "Zuletzt geöffnet"), so the method under-reports and
    // the file reads clean. The class below is unicode-property based and the
    // `u` flag is mandatory for `\p{…}` to mean anything at all.
    const INNER = '[\\p{L}\\p{M}\\p{N}\\p{P}\\p{Zs}]*?';
    const mismatch = new RegExp(`${OPEN}${INNER}${STRAIGHT}`, 'gu');
    const ok = new RegExp(`${OPEN}${INNER}${CLOSE}`, 'gu');

    // The formulation itself must be able to see a mismatch, or its zero below
    // proves nothing. Umlaut inside the span on purpose.
    expect('Registerkarte „Alle Datensätze" anzeigen'.match(mismatch)).toHaveLength(1);
    expect('Registerkarte „Alle Datensätze“ anzeigen'.match(mismatch)).toBeNull();

    const found: string[] = [];
    let okSpans = 0;
    for (const [key, value] of DE) {
      const bad = value.match(mismatch);
      if (bad) found.push(`${key}: ${bad.join(' | ')}`);
      okSpans += (value.match(ok) ?? []).length;
    }
    expect(found, `„…" mismatches:\n${found.join('\n')}`).toEqual([]);
    expect(okSpans, 'correctly paired spans').toBe(45);
  });

  it('keeps the count identity that replaces the card’s count(„) === count(“)', () => {
    const whole = DE.map(([, v]) => v).join(String.fromCharCode(10));
    const open = count(whole, OPEN);
    const close = count(whole, CLOSE);
    const rdq = count(whole, RDQ);

    // Measured at landing: 45 / 47 / 2. See the header for why the naive
    // equality is false on a correctly fixed file.
    expect({ open, close, rdq }).toEqual({ open: 45, close: 47, rdq: 2 });
    // The durable shape: every „ closed by a “, every surplus “ an English
    // opener answered by a ”. Survives translating the two English values.
    expect(close).toBe(open + rdq);

    // And the surplus is exactly those two, still English, still tracked
    // separately — not German values with a stray closer.
    const rdqKeys = DE.filter(([, v]) => v.includes(RDQ)).map(([k]) => k);
    expect(rdqKeys).toEqual(['grid.import.savedMappingHint', 'grid.import.savedMappingPreviewNote']);
  });

  it('leaves `en` alone — the fix must not leak across packs', () => {
    // en quotes with ASCII on both sides; the drift gate only fires on en
    // changes, so this is the cheap local proof that none happened.
    expect(at(builtInLocales.en, 'empty.pageNotFoundDescription')).toContain('"{{name}}"');
    expect(at(builtInLocales.en, 'console.objectView.ufShowAllRecords')).toContain('"All records"');
    expect(count(JSON.stringify(builtInLocales.en), OPEN)).toBe(0);
  });

  it('records the remaining straight quotes in de: the approvalsInbox trio, filed separately', () => {
    // A different defect shape, deliberately NOT fixed here (this issue is the
    // mismatched pair): these three quote with ASCII on BOTH sides while their
    // own sibling `approvalsInbox.approveOneTitle` is correctly „…“. Pinned so
    // the number cannot drift unnoticed while that finding waits its turn — and
    // so a future fix has to come back and update this list.
    const straight = DE.filter(([, v]) => v.includes(STRAIGHT)).map(([k]) => k);
    expect(straight).toEqual([
      'approvalsInbox.rejectOneTitle',
      'approvalsInbox.inlineApproved',
      'approvalsInbox.inlineRejected',
    ]);
    expect(at(builtInLocales.de, 'approvalsInbox.approveOneTitle')).toBe('„{{title}}“ genehmigen?');
  });
});
