/**
 * The three ADR-0080 browser preview harnesses, held to the page-source styling
 * rule BY THAT RULE — `validatePageSourceStyling` from `@objectstack/lint`, the
 * same `page-source-className-tailwind` an author gets from `os validate`. Not a
 * local re-implementation: a copy of a rule cannot disagree with itself.
 *
 * WHY THIS FILE EXISTS (objectui#5470). A page's `source` is RUNTIME metadata.
 * The console's Tailwind is compiled at BUILD time by scanning the console's own
 * `src` (`@source '../src/**'` in `apps/console/src/index.css`) with no
 * safelist, so a utility class authored in real page metadata produces no CSS
 * and no error anywhere — the ADR-0065 "works only by coincidence" failure,
 * recorded as ADR-0080's 2026-06-30 amendment. These three harnesses are the one
 * place in the repo where the rule is violated AND STILL LOOKS RIGHT, because
 * each harness file is itself inside the scanned `src`. Lift one of their source
 * strings into a real page and every class evaporates silently.
 *
 * So the harnesses are split, and both halves are pinned here:
 *   - `sdui-tiers-preview.tsx` makes an explicit AUTHORING claim ("Browser
 *     preview for the two AI-authoring tiers"), so it was rewritten to each
 *     tier's real primitive and must stay at ZERO findings.
 *   - the other two are renderer-PLUMBING previews that keep their Tailwind and
 *     declare the exception in their headers. They are pinned as EXPECTED
 *     findings carrying that note — so the note cannot be deleted while the
 *     classNames stand, a cleanup cannot land unnoticed, and a NEW harness
 *     cannot quietly inherit the exception.
 */
import { describe, it, expect } from 'vitest';
import { validatePageSourceStyling, PAGE_SOURCE_CLASSNAME } from '@objectstack/lint';
import { parseJsx } from '@object-ui/sdui-parser';

/**
 * The harness files as TEXT, enumerated by Vite rather than `node:fs`: this
 * app's tsconfig is browser-only (`lib: ES2020, DOM`, `types` without `node`),
 * so a `node:fs` import passes under Vitest and fails the console's `tsc` —
 * the trap `insecure-origin-crypto.placement.test.ts` records. The glob is also
 * the enumeration the last test needs: Vite expands it against the real
 * directory at transform time, so a NEW harness appears here without anyone
 * remembering to add it.
 */
const harnesses = import.meta.glob('../*-preview.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** The header line every harness that keeps its Tailwind must carry. */
const EXCEPTION_ANCHOR = ' * ADR-0080 EXCEPTION — Tailwind in page source';

interface HarnessPage {
  kind: string;
  name: string;
  source: string;
}

/**
 * Pull the page objects out of a harness file: every `kind: '<k>'` inside an
 * object literal that also carries a `source`, with the source resolved from
 * the template literal it names (or the ES-shorthand `source` const).
 *
 * Deliberately fails loudly rather than returning nothing: an extractor that
 * silently finds zero pages is indistinguishable from a clean file, which is
 * the exact way a count-based guard rots (objectui#5470 — the card's own 79 was
 * a whole-file `grep -c`, i.e. LINES, harness JSX included; the rule's own count
 * over the source strings is 95).
 */
function pagesOf(text: string): HarnessPage[] {
  const pages: HarnessPage[] = [];
  for (const m of text.matchAll(/\bkind:\s*'([a-z]+)'/g)) {
    // widen from the `kind:` match to the enclosing object literal
    const open = text.lastIndexOf('{', m.index);
    if (open < 0) continue;
    let depth = 0;
    let close = open;
    for (; close < text.length; close++) {
      if (text[close] === '{') depth++;
      else if (text[close] === '}' && --depth === 0) break;
    }
    const objText = text.slice(open, close + 1);
    const bound = objText.match(/\bsource:\s*([A-Za-z_$][\w$]*)/);
    const ident = bound ? bound[1] : /\bsource\s*[,}]/.test(objText) ? 'source' : null;
    if (!ident) continue;
    const decl = new RegExp(String.raw`^const\s+${ident}\s*=\s*\``, 'm').exec(text);
    if (!decl) continue;
    const start = decl.index + decl[0].length;
    let i = start;
    while (i < text.length) {
      if (text[i] === '\\') { i += 2; continue; }
      if (text[i] === '`') break;
      i++;
    }
    const name = objText.match(/\bname:\s*'([^']+)'/)?.[1] ?? ident;
    pages.push({ kind: m[1], name, source: text.slice(start, i) });
  }
  return pages;
}

function findingsFor(pages: HarnessPage[]) {
  return validatePageSourceStyling({ pages: pages as unknown as Record<string, unknown>[] });
}

function read(file: string): string {
  const text = harnesses[`../${file}`];
  // A missing key means the file was renamed or the glob stopped matching —
  // fail loudly rather than assert over an empty string, which reads exactly
  // like a clean file.
  if (typeof text !== 'string') {
    throw new Error(`${file} is not in the preview-harness glob (found: ${Object.keys(harnesses).join(', ')})`);
  }
  return text;
}

describe('ADR-0080 preview harnesses — page-source styling', () => {
  // ---- the instrument, before anything is asserted with it ----------------
  it('the rule fires on an authored className (control)', () => {
    const dirty = findingsFor([
      { kind: 'html', name: 'control', source: '<section className="p-4">x</section>' },
    ]);
    expect(dirty.map((f) => f.rule)).toEqual([PAGE_SOURCE_CLASSNAME]);
    expect(dirty[0].message).toContain('1 `className` attribute');

    // …and is silent on the same markup styled the prescribed way, so a green
    // result below means "clean", not "rule inert".
    const clean = findingsFor([
      { kind: 'html', name: 'control', source: '<section style={{"padding":"var(--space-4)"}}>x</section>' },
    ]);
    expect(clean).toEqual([]);
  });

  // ---- (a) the authoring example: zero findings ---------------------------
  it('sdui-tiers-preview.tsx authors no Tailwind in either page source', () => {
    const pages = pagesOf(read('sdui-tiers-preview.tsx'));
    expect(pages.map((p) => `${p.name}:${p.kind}`)).toEqual([
      'release_notes:html',
      'pipeline_react:react',
    ]);
    expect(findingsFor(pages)).toEqual([]);
  });

  it("the html-tier source's JSON style objects materialize (not deferred expressions)", () => {
    const [html] = pagesOf(read('sdui-tiers-preview.tsx'));
    const parsed = parseJsx(html.source);
    expect(parsed.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);

    // A braced attribute is materialized by JSON.parse and kept as `{ $expr }`
    // otherwise, so JS-object syntax (`style={{ padding: 4 }}`) would parse
    // without complaint and render NOTHING. Every style here must be a real
    // object, and there must be some.
    const styles: unknown[] = [];
    const walk = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(walk);
      const rec = node as Record<string, unknown>;
      if ('style' in rec) styles.push(rec.style);
      if (Array.isArray(rec.children)) rec.children.forEach(walk);
    };
    walk(parsed.tree);
    expect(styles.length).toBeGreaterThan(8);
    for (const s of styles) {
      expect(s).toBeTypeOf('object');
      expect(s).not.toHaveProperty('$expr');
    }
  });

  // ---- (b) the plumbing previews: exception kept, and declared ------------
  it.each([
    ['sdui-jsx-preview.tsx', 48],
    ['sdui-workbench-preview.tsx', 21],
  ])('%s keeps its Tailwind AND declares the exception', (file, expected) => {
    const text = read(file);
    const pages = pagesOf(text);
    expect(pages).toHaveLength(1);

    const findings = findingsFor(pages);
    expect(findings.map((f) => f.rule)).toEqual([PAGE_SOURCE_CLASSNAME]);
    // The rule counts `className=` inside the source string; pinning the number
    // means a class added or removed here is a deliberate, reviewed edit.
    expect(findings[0].message).toContain(`${expected} \`className\` attributes`);

    // The note is what makes the exception legible to the next reader. If the
    // classNames ever go, this assertion is the reminder to drop the note too.
    expect(text.split('\n')).toContain(EXCEPTION_ANCHOR);
  });

  // ---- no silent third path ----------------------------------------------
  it('every preview harness in src/ is one of the two declared shapes', () => {
    const files = Object.keys(harnesses).map((k) => k.replace('../', ''));
    expect(files.length).toBeGreaterThanOrEqual(3);
    expect(files).toEqual(
      expect.arrayContaining([
        'sdui-jsx-preview.tsx',
        'sdui-tiers-preview.tsx',
        'sdui-workbench-preview.tsx',
      ]),
    );

    for (const file of files) {
      const text = read(file);
      const pages = pagesOf(text);
      if (pages.length === 0) continue; // not a source-tier harness
      const dirty = findingsFor(pages).length > 0;
      const declared = text.split('\n').includes(EXCEPTION_ANCHOR);
      expect(
        dirty === declared,
        dirty
          ? `${file} authors Tailwind in page source without the "${EXCEPTION_ANCHOR.trim()}" header note. ` +
            'Style with the tier primitive (content/docs/guide/react-pages.md §Styling), or declare the exception.'
          : `${file} carries the exception note but authors no Tailwind in page source — drop the note.`,
      ).toBe(true);
    }
  });
});
