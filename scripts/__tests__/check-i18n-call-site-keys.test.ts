import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  analyze,
  applyBaseline,
  collectEnKeys,
  collectSourceFiles,
  EXCLUDED_TRANSLATORS,
  DYNAMIC_KEY_FAMILIES,
  EXTERNALLY_INTERPOLATED_HOLES,
  holesOf,
  PACK_HOOK,
  readVocabulary,
  RESERVED_OPTION_NAMES,
} from '../check-i18n-call-site-keys.mjs';

/**
 * objectui#3530 — the behaviour test for `scripts/check-i18n-call-site-keys.mjs`.
 *
 * The gate answers "does the key this component asks for exist in `en`?", which
 * `packages/i18n/src/__tests__/all-locales-key-parity.test.ts` structurally
 * cannot: parity compares packs to each other, so ten packs identically missing
 * a key is full parity and full parity is green. objectui#3517 lived in that
 * blind spot for months; the gate's first full run found 258 more keys there.
 *
 * Two halves are pinned here, and they fail for different reasons:
 *
 *   1. The `en` key set is READ FROM AST, not imported, so the gate needs no
 *      build. That buys a second source of truth, and the first `describe`
 *      below is what stops it drifting: the parsed set must equal the set of
 *      the real module vitest evaluates. A parser that silently drops a subtree
 *      would make every key under it look missing (false red) — or, if it drops
 *      the whole literal, make the scan collapse to an empty comparison that
 *      passes while asserting nothing (the objectui#3009 shape).
 *
 *   2. Which `t` is being called. `t` is not one function in this repo: 2370
 *      calls reach i18next, 1074 reach a module-local `engine.*` table, 41 are
 *      not translators at all. The synthetic-repo tests pin each classification
 *      independently of what today's `main` happens to contain.
 *
 *   3. objectui#3810 added a third: the gate now reads `en` VALUES, and a call
 *      site's own inline `defaultValue` must repeat the value byte for byte
 *      whenever the key exists. Both halves are pinned — the extractor against
 *      the evaluated module (values, not only keys), and the rule's verdicts
 *      against synthetic repos, including the cases it deliberately declines to
 *      judge. That last group is the one worth reading before widening the rule:
 *      each abstention is a decision, not an oversight.
 *
 *   4. objectui#3845 added a fourth: the arguments a call site passes must be
 *      exactly the `{{holes}}` the `en` value has to receive them. BOTH
 *      directions are pinned red below, because they fail differently — an inert
 *      argument is dropped in silence, an unfilled hole renders its own braces
 *      to the user — and a rule that only judged one of them would be green on
 *      half the class it names.
 *
 *   5. objectui#4117 added a fifth, and it is the first that reads the call's
 *      POSITION rather than its arguments: a literal fallback written beside the
 *      call (`t(key) || 'English'`) is dead once the key exists, and the verdict
 *      is deletion rather than alignment. Two of its cases carry more weight
 *      than the reds. The mirror shape `someValue || t(key)` is HEALTHY and
 *      outnumbers the class 94 to 24 on `main`, so a rule that read "appears in
 *      a `||`" would condemn four times more than it fixed. And an OPTIONAL call
 *      `t?.(key) ?? 'English'` really can reach its fallback, which is why the
 *      two `ContextSelectors.tsx` sites the filing card counted among the 24 are
 *      pinned here as abstentions instead.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tempRoots: string[] = [];

/**
 * The real `en` pack, read the way the gate's own consumers read it: evaluated
 * by the module loader, not parsed.
 *
 * Deliberately a COMPUTED dynamic import rather than
 * `import realEn from '../../packages/i18n/src/locales/en'`. A static specifier
 * would pull a 3.2k-line package source into `tsconfig.scripts.json`'s program,
 * and that project's placement in `ci.yml` rests on the premise that it reads
 * nothing outside `scripts/` — pinned by `scripts-type-check.test.ts`, whose
 * regex only looks for workspace-package specifiers and would not have caught a
 * relative one. Computing the path keeps the premise true instead of stepping
 * around the pin that guards it.
 */
const realEn: unknown = (
  await import(pathToFileURL(path.join(repoRoot, 'packages/i18n/src/locales/en.ts')).href)
).default;

/**
 * Module specifiers that appear inside the FIXTURE SOURCES below — text to be
 * analysed, not imports of this file. They are interpolated rather than written
 * out because `scripts-type-check.test.ts` greps this directory for import
 * statements naming a workspace package, to pin that the scripts project needs
 * no workspace build, and its regex cannot tell a string literal from an import
 * statement. (Nor a code comment from either — which is why this paragraph does
 * not spell the pattern out.)
 */
const I18N_PKG = '@object-ui/i18n';

/** Dotted leaf paths of a plain object — the shape the gate compares against. */
function leafPaths(node: unknown, prefix = ''): string[] {
  return node !== null && typeof node === 'object'
    ? Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
        leafPaths(v, prefix ? `${prefix}.${k}` : k),
      )
    : [prefix];
}

/** The same walk, carrying each leaf's STRING — what the drift rule compares. */
function leafEntries(node: unknown, prefix = ''): Array<[string, string]> {
  return node !== null && typeof node === 'object'
    ? Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
        leafEntries(v, prefix ? `${prefix}.${k}` : k),
      )
    : [[prefix, String(node)]];
}

/** Materialises `{ 'packages/x/src/a.tsx': '…' }` into a throwaway repo root. */
function repoWith(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'check-i18n-keys-'));
  tempRoots.push(root);
  for (const [rel, contents] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents);
  }
  return root;
}

/** A minimal `en` pack for the synthetic repos below. */
const EN_FIXTURE = `const en = {
  common: { save: 'Save', cancel: 'Cancel', loading: 'Loading...' },
  detail: { showEmptyRelated_one: '+ {{count}} empty', showEmptyRelated_other: '+ {{count}} empty' },
  grid: { column: { label: 'Label', width: 'Width' } },
  confirm: { purge: 'Deleting resets it to the shipped baseline. ' + 'Continue?' },
  interp: {
    greet: 'Hello {{name}}',
    both: 'Hello {{name}}, you have {{n}} messages',
    bare: 'Update',
    counted: 'Deleted {{count}} rows',
    enlarge: 'Enlarge {{name}}',
    imageAlt: 'Image {{index}}',
  },
  // The one shape that makes a non-optional \`t()\` falsy, so \`||\` really can
  // reach its right operand. \`en\` has no such leaf today (objectui#4117).
  edge: { blank: '' },
} as const;
export default en;
`;

/**
 * The registry's own element and vocabulary-spec types, taken from the module
 * rather than restated here — a restated shape is a second declaration free to
 * drift from the one the gate actually enforces.
 */
type Family = (typeof DYNAMIC_KEY_FAMILIES)[number];
type Spec = Parameters<typeof readVocabulary>[1];

/** Findings of `reason` produced for a synthetic repo, as `key@file:line`. */
function findingsOf(root: string, reason: string, families: Family[] = []): string[] {
  return analyze(root, { families })
    .findings.filter((f: { reason: string }) => f.reason === reason)
    .map((f: { detail: string; file: string; line: number }) => `${f.detail}@${f.file}:${f.line}`)
    .sort();
}

afterAll(() => {
  for (const root of tempRoots) fs.rmSync(root, { recursive: true, force: true });
});

describe('the parsed en key set equals the module vitest actually evaluates', () => {
  const parsed = collectEnKeys(repoRoot);
  const runtime = new Set(leafPaths(realEn));

  it('extracts exactly the real pack, key for key', () => {
    const missed = [...runtime].filter((k) => !parsed.leaves.has(k)).sort();
    const invented = [...parsed.leaves].filter((k) => !runtime.has(k)).sort();
    expect(missed, `${missed.length} real key(s) the AST parser did not see`).toEqual([]);
    expect(invented, `${invented.length} key(s) the AST parser invented`).toEqual([]);
  });

  it('is not a trivially-empty comparison', () => {
    // Same reason all-locales-key-parity.test.ts opens with a size assertion:
    // an extractor that returns nothing satisfies every assertion above.
    expect(parsed.leaves.size).toBeGreaterThan(2000);
    expect(parsed.branches.size).toBeGreaterThan(100);
  });

  it('records branches separately from leaves, for `returnObjects` lookups', () => {
    expect(parsed.branches.has('common')).toBe(true);
    expect(parsed.leaves.has('common')).toBe(false);
  });
});

describe('the file walk', () => {
  it('reads sources but not tests, type declarations or build output', () => {
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': EN_FIXTURE,
      'packages/x/src/widget.tsx': 'export const a = 1;',
      'packages/x/src/widget.test.tsx': 'export const b = 1;',
      'packages/x/src/__tests__/thing.ts': 'export const c = 1;',
      'packages/x/src/types.d.ts': 'export type D = 1;',
      'packages/x/dist/widget.js': 'nope',
      'packages/x/node_modules/dep/index.ts': 'export const e = 1;',
      'apps/console/src/page.tsx': 'export const f = 1;',
      'apps/site/app/page.tsx': 'export const g = 1;',
    });
    const files = collectSourceFiles(root).map((f: string) => path.relative(root, f).split(path.sep).join('/'));
    expect(files).toEqual([
      'apps/console/src/page.tsx',
      'apps/site/app/page.tsx',
      'packages/i18n/src/locales/en.ts',
      'packages/x/src/widget.tsx',
    ]);
  });
});

describe('a key a pack-backed t() asks for must exist in en', () => {
  it('reports the missing key with its file and line, and stays silent on the present one', () => {
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': EN_FIXTURE,
      'packages/x/src/Widget.tsx': `import { useObjectTranslation } from '${I18N_PKG}';
export function Widget() {
  const { t } = useObjectTranslation();
  return [t('common.save'), t('common.reset', { defaultValue: 'Reset' })];
}
`,
    });
    expect(findingsOf(root, 'missing-key')).toEqual(['common.reset@packages/x/src/Widget.tsx:4']);
  });

  it('an inline defaultValue does not make the key present — that is the bug, not the fix', () => {
    // objectui#3517's whole failure mode: English renders at this one call site
    // while all ten packs stay unable to translate it.
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': EN_FIXTURE,
      'packages/x/src/A.tsx': `import { useObjectTranslation } from '${I18N_PKG}';
export const A = () => { const { t } = useObjectTranslation(); return t('form.createTargetOrg', { defaultValue: 'Create org' }); };
`,
    });
    expect(findingsOf(root, 'missing-key')).toEqual(['form.createTargetOrg@packages/x/src/A.tsx:2']);
  });

  it('accepts a key the pack defines only in i18next plural forms', () => {
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': EN_FIXTURE,
      'packages/x/src/A.tsx': `import { useObjectTranslation } from '${I18N_PKG}';
export const A = () => { const { t } = useObjectTranslation(); return t('detail.showEmptyRelated', { count: 2 }); };
`,
    });
    expect(findingsOf(root, 'missing-key')).toEqual([]);
  });

  it('accepts a subtree key only when the call asks for `returnObjects`', () => {
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': EN_FIXTURE,
      'packages/x/src/A.tsx': `import { useObjectTranslation } from '${I18N_PKG}';
export const A = () => {
  const { t } = useObjectTranslation();
  return [t('grid.column', { returnObjects: true }), t('grid.column')];
};
`,
    });
    expect(findingsOf(root, 'missing-key')).toEqual(['grid.column@packages/x/src/A.tsx:4']);
  });

  it('reads every literal a call can denote: a chain array, a ternary, a cast', () => {
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': EN_FIXTURE,
      'packages/x/src/A.tsx': `import { useSafeTranslate } from '${I18N_PKG}';
export const A = (flag: boolean) => {
  const tt = useSafeTranslate();
  return [
    tt(['common.save', 'legacy.save'], 'Save'),
    tt(flag ? 'common.cancel' : 'legacy.cancel', 'Cancel'),
    tt('legacy.cast' as string, 'Cast'),
  ];
};
`,
    });
    expect(findingsOf(root, 'missing-key')).toEqual([
      'legacy.cancel@packages/x/src/A.tsx:6',
      'legacy.cast@packages/x/src/A.tsx:7',
      'legacy.save@packages/x/src/A.tsx:5',
    ]);
  });
});

describe('dynamic keys: counted, never failed — except when the whole family is dead', () => {
  it('a template key whose static head matches an en key is report-only', () => {
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': EN_FIXTURE,
      'packages/x/src/A.tsx': `import { useObjectTranslation } from '${I18N_PKG}';
export const A = (c: string) => { const { t } = useObjectTranslation(); return t(\`grid.column.\${c}\`); };
`,
    });
    // `families: []` — this case is about the PREFIX rule, so the registry is
    // emptied rather than left pointing at the real repo's 25 heads, none of
    // which exist in a synthetic root. The registry's own rules get their own
    // describe below.
    const { findings, counters } = analyze(root, { families: [{ head: 'grid.column.', enumerable: false, why: 'runtime-data', reason: 'fixture' }] });
    expect(findings).toEqual([]);
    expect(counters.dynamicKeySites).toBe(1);
  });

  it('a template key whose static head matches nothing fails: every expansion misses', () => {
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': EN_FIXTURE,
      'packages/x/src/A.tsx': `import { useObjectTranslation } from '${I18N_PKG}';
export const A = (c: string) => { const { t } = useObjectTranslation(); return t(\`gantt.linkEnd.\${c}\` as any); };
`,
    });
    expect(findingsOf(root, 'missing-prefix')).toEqual(['gantt.linkEnd.@packages/x/src/A.tsx:2']);
  });

  it('the prefix rule still fires on a head the registry DECLARES — the two rules stack, they do not replace each other', () => {
    // objectui#4964's guard against the failure this lane keeps hitting: a
    // stricter-looking gate that silently covers less. Declaring a family must
    // never buy it out of `missing-prefix`.
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': EN_FIXTURE,
      'packages/x/src/A.tsx': `import { useObjectTranslation } from '${I18N_PKG}';
export const A = (c: string) => { const { t } = useObjectTranslation(); return t(\`nowhere.\${c}\`); };
`,
      'packages/x/src/vocab.ts': `export type Nowhere = 'a' | 'b';\n`,
    });
    const families: Family[] = [{ head: 'nowhere.', vocabulary: { module: 'packages/x/src/vocab.ts', name: 'Nowhere', kind: 'union' } }];
    const reasons = analyze(root, { families }).findings.map((f: { reason: string }) => f.reason).sort();
    expect(reasons).toEqual(['missing-member', 'missing-member', 'missing-prefix']);
  });

  it('a fully computed key is counted and left alone — there is no head to judge', () => {
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': EN_FIXTURE,
      'packages/x/src/A.tsx': `import { useObjectTranslation } from '${I18N_PKG}';
export const A = (k: string) => { const { t } = useObjectTranslation(); return t(k); };
`,
    });
    const { findings, counters } = analyze(root, { families: [] });
    expect(findings).toEqual([]);
    expect(counters.dynamicKeySites).toBe(1);
    // No static head at all, so it is not a family either — neither rule can
    // reach it, and the counter is the only trace it leaves.
    expect(counters.headlessDynamicKeySites).toBe(1);
  });
});

describe('the I18N_PROBE_FLAG exclusion is structural, not path-based', () => {
  // `useObjectLabel` probes convention keys that are SUPPOSED to miss. Both of
  // its real call sites use dynamic keys, so on today's `main` the flag only
  // moves them out of the dynamic counter. This is the shape that makes the
  // exclusion load-bearing, and it is pinned here rather than left to the next
  // literal-key probe to discover.
  const probeFile = `import { useObjectTranslation } from '${I18N_PKG}';
import { I18N_PROBE_FLAG } from '${I18N_PKG}';
export const A = () => {
  const { t } = useObjectTranslation();
  return t('crm.objects.lead.label', { defaultValue: '', [I18N_PROBE_FLAG]: true });
};
`;

  it('skips a flagged literal-key probe wherever it is written', () => {
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': EN_FIXTURE,
      'packages/anything/src/Probe.tsx': probeFile,
    });
    const { findings, counters } = analyze(root, { families: [] });
    expect(findings).toEqual([]);
    expect(counters.probeSites).toBe(1);
  });

  it('the very same call without the flag is reported', () => {
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': EN_FIXTURE,
      'packages/anything/src/Probe.tsx': probeFile.replace(', [I18N_PROBE_FLAG]: true', ''),
    });
    expect(findingsOf(root, 'missing-key')).toEqual(['crm.objects.lead.label@packages/anything/src/Probe.tsx:5']);
  });
});

describe('which `t` is being called', () => {
  it('skips the registered module-local table, and the components it hands `t` to', () => {
    const localModule = EXCLUDED_TRANSLATORS[0].module;
    const localScope = EXCLUDED_TRANSLATORS[0].forwardedScope[0];
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': EN_FIXTURE,
      [localModule]: `export function t(key: string): string { return key; }\n`,
      [`${localScope}Page.tsx`]: `import { t } from './i18n';
export const Page = () => t('engine.directory.title');
`,
      [`${localScope}Child.tsx`]: `export const Child = ({ t }: { t: (key: string) => string }) => t('engine.edit.layers');
`,
    });
    const { findings, counters } = analyze(root, { families: [] });
    expect(findings).toEqual([]);
    expect(counters.skippedLocalTable).toBeGreaterThanOrEqual(2);
    expect(counters.packCallSites).toBe(0);
  });

  it('reaches the same module through the ESM-correct `./i18n.js` spelling', () => {
    // objectui#5357: `@object-ui/app-shell` ships a `tsc` build, so Node's
    // resolver requires the EMITTED extension on every relative specifier and
    // `./i18n` had to become `./i18n.js`. The registry names the SOURCE file,
    // so a resolver that does not strip the emitted extension resolves the
    // import to `…/metadata-admin/i18n.js` — a path with no file behind it —
    // and every call site through that table becomes an
    // `unregistered-translator` finding. Measured before the fix: the real
    // repository reported them in the hundreds while the specifier was right.
    const localModule = EXCLUDED_TRANSLATORS[0].module;
    const localScope = EXCLUDED_TRANSLATORS[0].forwardedScope[0];
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': EN_FIXTURE,
      [localModule]: `export function t(key: string): string { return key; }\n`,
      [`${localScope}Page.tsx`]: `import { t } from './i18n.js';
export const Page = () => t('engine.directory.title');
`,
    });
    const { findings, counters } = analyze(root, { families: [] });
    expect(findings).toEqual([]);
    expect(counters.skippedLocalTable).toBeGreaterThanOrEqual(1);
  });

  it('fails on a `t` imported from a module nobody registered', () => {
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': EN_FIXTURE,
      'packages/x/src/labels.ts': `export function t(key: string): string { return key; }\n`,
      'packages/x/src/A.tsx': `import { t } from './labels';
export const A = () => t('whatever.key');
`,
    });
    expect(findingsOf(root, 'unregistered-translator')).toEqual([
      'packages/x/src/labels.ts@packages/x/src/A.tsx:2',
    ]);
  });

  it('fails when createSafeTranslation is bound outside the hook-name convention', () => {
    // The name IS the classification, so a factory bound to `copy` would take
    // every call through it off the checked surface without a word.
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': EN_FIXTURE,
      'packages/x/src/A.tsx': `import { createSafeTranslation } from '${I18N_PKG}';
const copy = createSafeTranslation({}, 'common.save');
export const A = () => { const { t } = copy(); return t('common.save'); };
`,
    });
    expect(findingsOf(root, 'unrecognised-hook')).toEqual(['copy@packages/x/src/A.tsx:2']);
    expect(PACK_HOOK.test('copy')).toBe(false);
    expect(['useObjectTranslation', 'useSafeTranslate', 'useKanbanT', 'useFieldTranslate'].every((n) => PACK_HOOK.test(n))).toBe(true);
  });

  it('ignores a local `t` that is not a translator at all', () => {
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': EN_FIXTURE,
      'packages/x/src/A.ts': `export const A = (start: number) => {
  const t = () => Date.now() - start;
  return t();
};
`,
    });
    const { findings, counters } = analyze(root, { families: [] });
    expect(findings).toEqual([]);
    expect(counters.skippedNotATranslator).toBe(1);
  });

  it('resolves the nearest binding, so an inner shadow does not inherit the hook', () => {
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': EN_FIXTURE,
      'packages/x/src/A.tsx': `import { useObjectTranslation } from '${I18N_PKG}';
export const A = () => {
  const { t } = useObjectTranslation();
  const inner = () => {
    const t = (n: number) => n * 2;
    return t(21);
  };
  return [t('legacy.outer'), inner()];
};
`,
    });
    // Only the outer, hook-bound call is judged; `t(21)` is not a key at all.
    expect(findingsOf(root, 'missing-key')).toEqual(['legacy.outer@packages/x/src/A.tsx:8']);
  });

  it('checks a translator forwarded into a helper module with no binding of its own', () => {
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': EN_FIXTURE,
      'packages/x/src/helpers.ts': `type TranslateFn = (key: string) => string;
export function describe(t: TranslateFn): string { return t('legacy.helper'); }
`,
    });
    expect(findingsOf(root, 'missing-key')).toEqual(['legacy.helper@packages/x/src/helpers.ts:2']);
  });
});

describe('an inline defaultValue on a key that EXISTS must match the en value (objectui#3810)', () => {
  /** Findings of `reason`, rendered as `key: expected -> actual`. */
  function driftOf(root: string): string[] {
    return analyze(root, { families: [] })
      .findings.filter((f: { reason: string }) => f.reason === 'default-value-drift')
      .map((f: { detail: string; expected: string; actual: string }) => `${f.detail}: ${f.expected} -> ${f.actual}`)
      .sort();
  }

  it('is silent when the call site copies the pack value byte for byte', () => {
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': EN_FIXTURE,
      'packages/x/src/A.tsx': `import { useObjectTranslation } from '${I18N_PKG}';
export const A = () => { const { t } = useObjectTranslation(); return t('common.save', { defaultValue: 'Save' }); };
`,
    });
    const { findings, counters } = analyze(root, { families: [] });
    expect(findings).toEqual([]);
    expect(counters.matchingDefaultValues).toBe(1);
  });

  it('reports the dead string that says something else, with both texts', () => {
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': EN_FIXTURE,
      'packages/x/src/A.tsx': `import { useObjectTranslation } from '${I18N_PKG}';
export const A = () => { const { t } = useObjectTranslation(); return t('common.save', { defaultValue: 'Save changes' }); };
`,
    });
    expect(driftOf(root)).toEqual(['common.save: Save -> Save changes']);
  });

  it('catches a difference of one character — the ellipsis families are the whole reason', () => {
    // `Loading...` (three periods) against `Loading` + U+2026 renders the same to
    // a reader skimming a diff, which is how six of the 43 sites survived. Both
    // sides are written as escapes here for the same reason.
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': EN_FIXTURE,
      'packages/x/src/A.tsx': `import { useObjectTranslation } from '${I18N_PKG}';
export const A = () => { const { t } = useObjectTranslation(); return t('common.loading', { defaultValue: 'Loading\\u2026' }); };
`,
    });
    expect(driftOf(root)).toEqual(['common.loading: Loading... -> Loading\u2026']);
  });

  it('folds a concatenated en value before comparing, so a wrapped sentence is judged', () => {
    const both = 'Deleting resets it to the shipped baseline. Continue?';
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': EN_FIXTURE,
      'packages/x/src/A.tsx': `import { useObjectTranslation } from '${I18N_PKG}';
export const A = () => {
  const { t } = useObjectTranslation();
  return [t('confirm.purge', { defaultValue: '${both}' }), t('confirm.purge', { defaultValue: 'Continue?' })];
};
`,
    });
    // The matching one is silent; only the half-sentence is reported.
    expect(driftOf(root)).toEqual([`confirm.purge: ${both} -> Continue?`]);
  });

  it('leaves a key en does not define to the missing-key rule, and reports it ONCE', () => {
    // The two classes must stay disjoint: a missing key with an inline default is
    // objectui#3517's shape, and saying "and it drifts" about a key with no value
    // would be both noise and false.
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': EN_FIXTURE,
      'packages/x/src/A.tsx': `import { useObjectTranslation } from '${I18N_PKG}';
export const A = () => { const { t } = useObjectTranslation(); return t('common.reset', { defaultValue: 'Reset' }); };
`,
    });
    expect(analyze(root, { families: [] }).findings.map((f: { reason: string }) => f.reason)).toEqual(['missing-key']);
  });

  it('counts rather than judges a computed default — there is no text to compare', () => {
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': EN_FIXTURE,
      'packages/x/src/A.tsx': `import { useObjectTranslation } from '${I18N_PKG}';
export const A = (label: string) => {
  const { t } = useObjectTranslation();
  return [t('common.save', { defaultValue: label }), t('common.cancel', { defaultValue: \`Go \${label}\` })];
};
`,
    });
    const { findings, counters } = analyze(root, { families: [] });
    expect(findings).toEqual([]);
    expect(counters.computedDefaultValues).toBe(2);
    expect(counters.literalDefaultValues).toBe(0);
  });

  it('counts rather than judges a plural family and a several-literal key', () => {
    // `detail.showEmptyRelated` resolves through `_one`/`_other`: there is no one
    // form to compare against, and picking one would be an invention.
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': EN_FIXTURE,
      'packages/x/src/A.tsx': `import { useObjectTranslation } from '${I18N_PKG}';
export const A = (flag: boolean) => {
  const { t } = useObjectTranslation();
  return [
    t('detail.showEmptyRelated', { count: 2, defaultValue: 'anything' }),
    t(flag ? 'common.save' : 'common.cancel', { defaultValue: 'anything' }),
    t('grid.column', { returnObjects: true, defaultValue: 'anything' }),
  ];
};
`,
    });
    const { findings, counters } = analyze(root, { families: [] });
    expect(findings).toEqual([]);
    expect(counters.unjudgedDefaultValues).toBe(3);
  });

  it('reads the same values the module loader evaluates, not just the same keys', () => {
    // The key half of this pin has existed since objectui#3530; the value half
    // is what the drift rule rests on. A parser that folded a concatenation
    // wrongly, or dropped an escape, would accuse correct call sites.
    const parsed = collectEnKeys(repoRoot);
    const runtime = new Map(leafEntries(realEn));
    const disagreeing = [...runtime]
      .filter(([key, value]) => parsed.values.has(key) && parsed.values.get(key) !== value)
      .map(([key]) => key);
    const unread = [...runtime.keys()].filter((key) => !parsed.values.has(key));
    expect(disagreeing, `${disagreeing.length} key(s) parsed to a different string`).toEqual([]);
    expect(unread, 'every leaf in en today is a static string, so none should be unreadable').toEqual([]);
    expect(parsed.values.size).toBeGreaterThan(2000);
  });

  it('main carries no drift, which is why this rule has no baseline', () => {
    // objectui#3810 measured 43 sites in 19 files and aligned all of them in the
    // same PR. A finding here is a NEW divergence: fix the call site, not the
    // pack. If this ever has to be waived, that decision needs a baseline
    // section and an issue — not an edit to `en.ts` to make the red go away.
    expect(driftOf(repoRoot)).toEqual([]);
  });
});

describe('what a call site passes must be what the en value has holes for (objectui#3845)', () => {
  /** Parity findings as `key: inert=[…] unfilled=[…]` — both directions visible. */
  function parityOf(root: string): string[] {
    return analyze(root, { families: [] })
      .findings.filter((f: { reason: string }) => f.reason === 'interpolation-parity')
      .map(
        (f: { detail: string; inert: string[]; unfilled: string[] }) =>
          `${f.detail}: inert=[${f.inert.join(',')}] unfilled=[${f.unfilled.join(',')}]`,
      )
      .sort();
  }

  /** One synthetic component whose body is `return <expr>;` inside a hook-bound `t`. */
  function callSite(body: string): Record<string, string> {
    return {
      'packages/i18n/src/locales/en.ts': EN_FIXTURE,
      'packages/x/src/A.tsx': `import { useObjectTranslation } from '${I18N_PKG}';
export const A = (name: string, n: number, idx: number) => {
  const { t } = useObjectTranslation();
  return ${body};
};
`,
    };
  }

  it('is silent when the argument set is exactly the hole set', () => {
    const root = repoWith(callSite("[t('interp.greet', { name }), t('interp.both', { name, n }), t('interp.bare')]"));
    const { findings, counters } = analyze(root, { families: [] });
    expect(findings).toEqual([]);
    // Shorthand properties (`{ name }`) are names too — the AST form differs from
    // `{ name: name }` and reading only one of them would make the rule blind to
    // whichever spelling the next author picks.
    expect(counters.judgedInterpolation).toBe(3);
  });

  it('RED, direction one: an argument with no hole to receive it is inert', () => {
    // objectui#3845's own instance, in miniature: i18next drops it in silence, so
    // nothing anywhere else in the stack will ever say a word about it.
    const root = repoWith(callSite("t('interp.bare', { version: name })"));
    expect(parityOf(root)).toEqual(['interp.bare: inert=[version] unfilled=[]']);
  });

  it('RED, direction two: a hole with no argument renders its own braces', () => {
    // The reverse the card measured at 0 on the day the rule landed. Judged
    // anyway — "0 by luck" and "0 by guarantee" are different states, and this is
    // the test that tells them apart.
    const root = repoWith(callSite("t('interp.greet')"));
    expect(parityOf(root)).toEqual(['interp.greet: inert=[] unfilled=[name]']);
  });

  it('reports both directions on one call site, because they are one disagreement', () => {
    const root = repoWith(callSite("t('interp.both', { name, wrong: n })"));
    expect(parityOf(root)).toEqual(['interp.both: inert=[wrong] unfilled=[n]']);
  });

  it('an options object is not needed to be judged — a bare t() can still leave a hole open', () => {
    const root = repoWith(callSite("[t('interp.greet'), t('interp.bare')]"));
    // Only the one with a hole is reported; a call with neither holes nor
    // arguments is the ordinary case and must stay silent.
    expect(parityOf(root)).toEqual(['interp.greet: inert=[] unfilled=[name]']);
  });

  it('reads only the outer options object, not a nested t() inside one of its values', () => {
    // THE documented false positive of this class (objectui#3845): the census
    // that found it was done with a regex first, and the regex read the inner
    // call's `index:` as an argument of the outer `fields.image.enlarge`, scoring
    // 2 hits where there was 1. This is that exact shape, and both calls are
    // correct — so the whole thing must be silent.
    const root = repoWith(callSite("t('interp.enlarge', { name: name || t('interp.imageAlt', { index: idx + 1 }) })"));
    const { findings, counters } = analyze(root, { families: [] });
    expect(findings).toEqual([]);
    expect(counters.judgedInterpolation).toBe(2);
  });

  it('a nested t() that IS wrong is still caught, on its own call site', () => {
    // The mirror of the test above: excluding the inner call's arguments from the
    // OUTER name set must not exclude the inner call from being judged at all.
    const root = repoWith(callSite("t('interp.enlarge', { name: t('interp.imageAlt', { wrong: idx }) })"));
    expect(parityOf(root)).toEqual(['interp.imageAlt: inert=[wrong] unfilled=[index]']);
  });

  it('the reservation protects `inert`: passing a control option is never flagged, holed key or not', () => {
    // `count` is an i18next control option, legitimate to PASS even when the
    // `en` value shows no visible `{{count}}` hole to receive it. The
    // reservation drops it from the names judged for `inert` — see the RED
    // case right below for the direction this must NOT also silence.
    const root = repoWith(
      callSite(
        "[t('interp.counted', { count: n }), t('interp.bare', { ns: 'x', lng: 'en', defaultValue: 'Update' })]",
      ),
    );
    expect(parityOf(root)).toEqual([]);
    expect(RESERVED_OPTION_NAMES.has('count')).toBe(true);
    expect(RESERVED_OPTION_NAMES.has('version')).toBe(false);
  });

  it('RED: the reservation must NOT also protect `unfilled` — a real {{count}} miss is still reported (objectui#4206)', () => {
    // Before objectui#4206, the reservation was subtracted from the shared
    // `holes` set BEFORE either direction was derived, so a `{{count}}` hole
    // was removed from the comparison entirely and `unfilled` could
    // structurally never contain `count` — this is objectui#4157's exact
    // shape: a call site passing no options against an `en` value that reads
    // `Deleted {{count}} rows`.
    const root = repoWith(callSite("t('interp.counted')"));
    expect(parityOf(root)).toEqual(['interp.counted: inert=[] unfilled=[count]']);
  });

  it('never judges a plural family, where there is no single value to read holes off', () => {
    const root = repoWith(callSite("t('detail.showEmptyRelated', { count: n, thing: name })"));
    const { findings, counters } = analyze(root, { families: [] });
    // `detail.showEmptyRelated` resolves through `_one`/`_other`; picking one
    // form's holes as the answer would be an invention, so `thing` goes
    // unreported rather than being called inert on a guess.
    expect(findings).toEqual([]);
    expect(counters.unjudgedInterpolation).toBeGreaterThanOrEqual(1);
  });

  it('abstains, loudly counted, when the option NAME SET cannot be read', () => {
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': EN_FIXTURE,
      'packages/x/src/A.tsx': `import { useObjectTranslation } from '${I18N_PKG}';
export const A = (rest: Record<string, unknown>, key: string, opts: Record<string, unknown>) => {
  const { t } = useObjectTranslation();
  return [
    t('interp.greet', { ...rest }),
    t('interp.greet', { [key]: 1 }),
    t('interp.greet', opts),
    t('interp.greet', { replace: { name: 'x' } }),
  ];
};
`,
    });
    const { findings, counters } = analyze(root, { families: [] });
    // A spread, a computed name and an opaque bag genuinely hide the set. The
    // fourth is different in kind and the same in verdict: `replace` REDIRECTS
    // where i18next takes interpolation data from, so the top-level names stop
    // being the answer to this question at all.
    expect(findings).toEqual([]);
    expect(counters.opaqueOptions).toBe(4);
    expect(counters.judgedInterpolation).toBe(0);
  });

  it('the two key classes still own their own territory — no double report', () => {
    // A key `en` does not define has no value, so it has no holes either. Saying
    // "and its arguments do not match" about it would be noise on top of the one
    // fact that matters, and false besides.
    const root = repoWith(callSite("t('nowhere.key', { name })"));
    expect(analyze(root, { families: [] }).findings.map((f: { reason: string }) => f.reason)).toEqual(['missing-key']);
  });

  it('reads a formatter, an unescape marker and a keypath as the option they name', () => {
    // None of these three shapes is in `en` today — all 84 distinct holes are
    // bare names. They cost four lines to read through and would otherwise each
    // become a phantom hole nobody passes.
    expect([...holesOf('{{name}}')].sort()).toEqual(['name']);
    expect([...holesOf('{{n, number}} of {{total, number}}')].sort()).toEqual(['n', 'total']);
    expect([...holesOf('{{- html}}')].sort()).toEqual(['html']);
    expect([...holesOf('{{user.name}} <{{user.email}}>')].sort()).toEqual(['user']);
    expect([...holesOf('no holes at all')].sort()).toEqual([]);
    // A single brace is not i18next interpolation — `auth.forgotPassword.
    // resendOtpCountdownText` uses `{seconds}` for exactly that reason.
    expect([...holesOf('Resend in {seconds}s')].sort()).toEqual([]);
  });

  describe('the EXTERNALLY_INTERPOLATED_HOLES registry — retired for auth.forgotPassword.successDescription (objectui#4135)', () => {
    it('is empty: the maintainer\'s 2026-08-11 ruling converged on single-brace `{x}` for every hole filled downstream of `t()`, which sits outside i18next\'s `{{…}}` syntax and needs no exemption', () => {
      expect(EXTERNALLY_INTERPOLATED_HOLES).toEqual([]);
    });

    it('so an argument-less `{{email}}` on that exact key is now judged like any other unfilled hole, not silenced', () => {
      // Before the retirement this exact call site (no `email` argument) was
      // silenced by the registry — `parityOf(root)` returned `[]`. A synthetic
      // pack is used here (not the repo's real, now single-brace, value) to
      // pin the GENERAL mechanism: whatever `en` happens to say, a bare
      // double-brace hole with no argument is always reported.
      const root = repoWith({
        'packages/i18n/src/locales/en.ts': EN_FIXTURE.replace(
          "edge: { blank: '' },",
          "edge: { blank: '' },\n  auth: { forgotPassword: { successDescription: 'Sent a reset link to {{email}}.' } },",
        ),
        'packages/x/src/A.tsx': `import { useObjectTranslation } from '${I18N_PKG}';
export const A = () => { const { t } = useObjectTranslation(); return t('auth.forgotPassword.successDescription'); };
`,
      });
      expect(parityOf(root)).toEqual(['auth.forgotPassword.successDescription: inert=[] unfilled=[email]']);
    });

    it('every entry the registry DOES hold still describes something real, in en AND in the source', () => {
      // Future-proofing: the registry mechanism stays in place, empty, for the
      // day a genuinely unavoidable double-brace hole is registered again. An
      // exemption that outlives the substitution it describes is an allowlist,
      // so both halves of each entry's premise (if any) are checked against
      // `main`: the pack really has the hole, and the named file really fills
      // it. Trivially true today because the loop runs zero times.
      const parsed = collectEnKeys(repoRoot);
      for (const entry of EXTERNALLY_INTERPOLATED_HOLES) {
        const value = parsed.values.get(entry.key);
        expect(value, `en does not define ${entry.key} as a string`).toBeTypeOf('string');
        for (const hole of entry.holes) {
          expect([...holesOf(value!)], `en value of ${entry.key} has no {{${hole}}}`).toContain(hole);
        }
        const filler = fs.readFileSync(path.join(repoRoot, entry.filledBy), 'utf8');
        expect(filler, `${entry.filledBy} no longer substitutes ${entry.key}`).toContain(entry.marker);
        expect(entry.reason.length).toBeGreaterThan(40);
      }
    });
  });

  it('main passes exactly the arguments its en values have holes for', () => {
    // objectui#3845 measured 3 inert sites and 0 unfilled ones on `main`, and
    // deleted all three arguments in the same PR — which is why this rule needs
    // no baseline. A finding here is a NEW disagreement: fix the call site.
    // Adding or removing a hole in `en.ts` to make it green is a copy change
    // that obliges nine more packs, and is never the way to silence this.
    expect(parityOf(repoRoot)).toEqual([]);
  });

  it('the three arguments this rule deleted are really gone, and their sisters are not', () => {
    // The stock, pinned by name rather than by a count: a rule with no baseline
    // has nothing else recording what it was worth on the day it landed.
    const gone: Array<[file: string, absent: string, present: string]> = [
      [
        'packages/app-shell/src/console/marketplace/MarketplacePackagePage.tsx',
        "t('marketplace.action.updateTo', { defaultValue: 'Update', version",
        "t('marketplace.action.updateTo', { defaultValue: 'Update' })",
      ],
      [
        'packages/app-shell/src/console/home/HomePage.tsx',
        "t('home.welcome', { product:",
        "t('home.welcome', { defaultValue: 'Build your business system with AI' })",
      ],
      [
        'packages/app-shell/src/hooks/useObjectActions.ts',
        "t('objectActions.resetPackageSetSuccess', {\n                label:",
        "t('objectActions.resetPackageSetSuccess', {",
      ],
    ];
    for (const [file, absent, present] of gone) {
      const src = fs.readFileSync(path.join(repoRoot, file), 'utf8');
      expect(src, `${file} still passes the inert argument`).not.toContain(absent);
      expect(src, `${file} lost the call site itself`).toContain(present);
    }
    // The sister call that DOES interpolate is untouched — deleting an argument
    // because it is inert must not read as "this file does not interpolate".
    const marketplace = fs.readFileSync(
      path.join(repoRoot, 'packages/app-shell/src/console/marketplace/MarketplacePackagePage.tsx'),
      'utf8',
    );
    expect(marketplace).toContain("t('marketplace.install.updateTo', { defaultValue: 'Update \\u2192 v{{version}}', version: latestVersion })");
  });
});

describe('a literal fallback beside the call is dead on every path (objectui#4117)', () => {
  /** Sibling findings as `key@line: <op> <dead operand>` — position and text both visible. */
  function siblingsOf(root: string): string[] {
    return analyze(root, { families: [] })
      .findings.filter((f: { reason: string }) => f.reason === 'dead-sibling-fallback')
      .map((f: { detail: string; line: number; operator: string; actual: string }) =>
        `${f.detail}@${f.line}: ${f.operator} ${f.actual}`,
      )
      .sort();
  }

  /** One synthetic component whose body is `return <expr>;` inside a hook-bound `t`. */
  function callSite(body: string): Record<string, string> {
    return {
      'packages/i18n/src/locales/en.ts': EN_FIXTURE,
      'packages/x/src/A.tsx': `import { useObjectTranslation } from '${I18N_PKG}';
export const A = (name: string, label: string, n: number) => {
  const { t } = useObjectTranslation();
  return ${body};
};
`,
    };
  }

  it('RED even when the dead string says exactly what the pack says', () => {
    // The load-bearing difference from `default-value-drift`. That rule aligns;
    // this one deletes, because the ruling on objectui#4117 keeps ONE blessed
    // fallback spelling rather than two. So byte-equality is not a defence — 21
    // of the 24 sites on `main` were byte-equal and every one of them went.
    expect(siblingsOf(repoWith(callSite("t('common.save') || 'Save'")))).toEqual([
      "common.save@4: || Save",
    ]);
  });

  it('RED, and it never reports WHAT the fallback should have said', () => {
    // A finding carries the dead text only to quote it. There is no "expected"
    // wording to move toward: the fix is deletion in both cases, and a hint that
    // said "make it match" would be teaching the spelling this class removes.
    expect(siblingsOf(repoWith(callSite("t('common.save') || 'Store'")))).toEqual([
      'common.save@4: || Store',
    ]);
  });

  it('RED for `??` as well as `||`, which is the same dead operand', () => {
    // `t()` returns a string on every path — the pack value, or the key itself
    // when i18next is not ready — so it is never nullish and `??` is as dead as
    // `||`. Reading only `||` would have missed both ContextSelectors sites.
    expect(siblingsOf(repoWith(callSite("t('common.cancel') ?? 'Cancel'")))).toEqual([
      'common.cancel@4: ?? Cancel',
    ]);
  });

  it('RED for a template-literal fallback — the divergent rows are all this shape', () => {
    // The five rows the card called out (`Removed ${n} sample record(s).` and
    // friends) are templates, not plain strings. A rule that only read plain
    // strings would have left exactly the sites whose text differs most.
    expect(siblingsOf(repoWith(callSite('t(\'interp.counted\', { count: n }) || `Deleted ${n} rows`')))).toEqual([
      'interp.counted@4: || `Deleted ${n} rows`',
    ]);
  });

  it('RED through the parentheses and casts a call site wraps itself in', () => {
    // `(t(k) || 'x')` inside a ternary arm is how 8 of the 22 were actually
    // written; walking up from `node.parent` without unwrapping would see a
    // ParenthesizedExpression and stop.
    expect(siblingsOf(repoWith(callSite("[(t('common.save')) || 'Save', (t('common.cancel') as string) || 'Cancel']")))).toEqual([
      'common.cancel@4: || Cancel',
      'common.save@4: || Save',
    ]);
  });

  it('GREEN for the mirror shape — a runtime value falling back to a translation', () => {
    // The direction that matters most for false positives: `main` carries 94 of
    // these against the 24 this class is about. Here the translation is the
    // fallback, which is the healthy arrangement and nothing to report.
    const root = repoWith(callSite("[label || t('common.save'), name ?? t('common.cancel')]"));
    expect(siblingsOf(root)).toEqual([]);
    expect(analyze(root, { families: [] }).counters.siblingFallbacks).toBe(0);
  });

  it('counts rather than judges a non-literal fallback — there is no copy to delete', () => {
    // `t(k) || label` renders a runtime value, so removing the operator would
    // change behaviour rather than delete dead code. Same abstention shape as a
    // computed `defaultValue` in objectui#3810.
    const root = repoWith(callSite("t('common.save') || label"));
    expect(siblingsOf(root)).toEqual([]);
    expect(analyze(root, { families: [] }).counters.computedSiblingFallbacks).toBe(1);
  });

  it('counts rather than judges an OPTIONAL call, where the fallback is live', () => {
    // Not a parser limitation but a reachable path, and the one case where this
    // class's premise is simply false: with `t` an optional prop, `t?.(k)` is
    // `undefined` whenever the prop is absent and the fallback is what renders.
    // Both sites left on `main` are this shape.
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': EN_FIXTURE,
      'packages/x/src/B.tsx': `export const B = ({ t, label }: { t?: (key: string, options?: any) => string; label: string }) => {
  return t?.('common.save') ?? 'Save';
};
`,
    });
    expect(siblingsOf(root)).toEqual([]);
    const { counters } = analyze(root, { families: [] });
    expect(counters.optionalCallFallbacks).toBe(1);
    // And the file was SCANNED at all: its only spelling is `t?.(`, which the
    // pre-filter used to drop — silently, out of all five classes at once.
    expect(counters.packCallSites).toBe(1);
  });

  it('counts rather than judges an en value that is itself falsy', () => {
    // The only way a non-optional `t()` can let `||` through. `en` has no empty
    // leaf today; the abstention is what stops the first one being a wrong red.
    const root = repoWith(callSite("t('edge.blank') || 'Something'"));
    expect(siblingsOf(root)).toEqual([]);
    expect(analyze(root, { families: [] }).counters.unjudgedSiblingFallbacks).toBe(1);
  });

  it('counts rather than judges a plural family and a dynamic key', () => {
    // Same preconditions as classes 3 and 4: a plural family has no single value
    // to read, and a dynamic key denotes no one key at all.
    const root = repoWith(callSite("[t('detail.showEmptyRelated', { count: n }) || 'more', t(`grid.column.${name}`) || 'Label']"));
    expect(siblingsOf(root)).toEqual([]);
    const { counters } = analyze(root, { families: [] });
    expect(counters.siblingFallbacks).toBe(2);
    expect(counters.unjudgedSiblingFallbacks).toBe(2);
  });

  it('leaves a key en does not define to the missing-key rule, and reports it ONCE', () => {
    // A key with no leaf has no value, so "the fallback cannot render" is not a
    // claim this rule can make about it — and objectui#3546 spent months in
    // exactly that transition, where the fallback is the only English there is.
    const root = repoWith(callSite("t('nowhere.key') || 'English'"));
    expect(analyze(root, { families: [] }).findings.map((f: { reason: string }) => f.reason)).toEqual(['missing-key']);
  });

  it('main carries no literal fallback beside a call, which is why this rule has no baseline', () => {
    // 24 sites measured on the tip this landed on: 22 judged and deleted in the
    // same PR, 2 abstained on as optional calls. A finding here is a NEW one.
    expect(siblingsOf(repoRoot)).toEqual([]);
  });

  it('the 22 deleted fallbacks are really gone, and the 2 live ones are untouched', () => {
    // The stock, pinned by name rather than by a count — a rule with no baseline
    // has nothing else recording what it was worth on the day it landed.
    const gone: Array<[file: string, absent: string, present: string]> = [
      [
        'packages/app-shell/src/console/marketplace/MarketplacePackagePage.tsx',
        "|| 'More options'",
        "aria-label={t('marketplace.detail.moreOptions')}",
      ],
      [
        'packages/app-shell/src/console/marketplace/MarketplacePackagePage.tsx',
        '|| `Removed ${removed} sample record(s).`',
        "t('marketplace.detail.purgeSuccess', { count: removed })",
      ],
      [
        'packages/app-shell/src/console/marketplace/MarketplacePackagePage.tsx',
        '|| `Sample data re-seeded (inserted=${inserted}, updated=${updated}).`',
        "t('marketplace.detail.reseedLocalSuccess', { inserted, updated })",
      ],
      [
        'packages/app-shell/src/views/ObjectView.tsx',
        // Tight on purpose: the file still holds a legitimate *computed*
        // `defaultValue` ending in the same sentence (line ~1657), and a marker
        // loose enough to catch that one would fail for the wrong reason.
        'delete the view "${viewLabel}"',
        "t('console.objectView.deleteViewConfirm', { name: viewLabel })",
      ],
      [
        'packages/app-shell/src/views/ActionResultDialog.tsx',
        "|| 'Copy all'",
        "label={t('actions.resultDialog.copyAll')}",
      ],
    ];
    for (const [file, absent, present] of gone) {
      const src = fs.readFileSync(path.join(repoRoot, file), 'utf8');
      expect(src, `${file} still carries the dead fallback`).not.toContain(absent);
      expect(src, `${file} lost the call site itself`).toContain(present);
    }
    // The two the rule abstains on are STILL THERE. Deleting them would have
    // replaced a rendered placeholder with `undefined` on every host that does
    // not pass the optional `t` — including this file's own persist test.
    const selectors = fs.readFileSync(
      path.join(repoRoot, 'packages/app-shell/src/layout/ContextSelectors.tsx'),
      'utf8',
    );
    expect(selectors).toContain("t?.('common.package', { defaultValue: rawLabel }) ?? rawLabel");
    expect(selectors).toContain('}) ?? `Select ${label}…`');
  });
});

describe('a declared dynamic family is checked MEMBER by member (objectui#4964)', () => {
  /**
   * The class the prefix rule structurally cannot reach: the head resolves, so
   * `missing-prefix` is satisfied, and one member of the vocabulary the call
   * site iterates has no leaf in `en`. Ten packs missing it identically is full
   * parity, so no pack gate sees it either.
   *
   * Every case below carries a NON-VACUITY half: a family whose members are all
   * present must produce no finding *while the checker is demonstrably reading
   * them*, because "found nothing" and "checked nothing" are the same output.
   * `counters.checkedMembers` is what tells them apart, and it is asserted on
   * every green case rather than only on the reds.
   */
  const enWithFamily = `const en = {
  common: { save: 'Save' },
  mode: { day: 'Day', week: 'Week' },
  badge: { alpha: { short: 'A', title: 'Alpha' }, beta: { short: 'B', title: 'Beta' } },
} as const;
export default en;
`;
  const callSite = (template: string) => `import { useObjectTranslation } from '${I18N_PKG}';
export const A = (x: string) => { const { t } = useObjectTranslation(); return t(\`${template}\`); };
`;

  it('reports the member `en` lacks, and only that one', () => {
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': enWithFamily,
      'packages/x/src/A.tsx': callSite('mode.${x}'),
      'packages/x/src/vocab.ts': `export type Mode = 'day' | 'week' | 'month';\n`,
    });
    const families: Family[] = [{ head: 'mode.', vocabulary: { module: 'packages/x/src/vocab.ts', name: 'Mode', kind: 'union' } }];
    const { findings, counters } = analyze(root, { families });
    expect(findings.map((f: { reason: string; detail: string }) => `${f.reason}:${f.detail}`)).toEqual([
      'missing-member:mode.month',
    ]);
    expect(counters.checkedMembers).toBe(3);
  });

  it('is silent when every member resolves — and proves it looked', () => {
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': enWithFamily,
      'packages/x/src/A.tsx': callSite('mode.${x}'),
      'packages/x/src/vocab.ts': `export type Mode = 'day' | 'week';\n`,
    });
    const families: Family[] = [{ head: 'mode.', vocabulary: { module: 'packages/x/src/vocab.ts', name: 'Mode', kind: 'union' } }];
    const { findings, counters } = analyze(root, { families });
    expect(findings).toEqual([]);
    // The non-vacuity half. Without this, a reader that silently returned no
    // members would produce exactly the same empty finding list.
    expect(counters.checkedMembers).toBe(2);
    expect(counters.enumerableFamilies).toBe(1);
  });

  it('expands the template TAIL, so a member is checked as the leaf the call site renders', () => {
    // `t(`badge.${k}.short`)` asks for `badge.alpha.short`, not `badge.alpha` —
    // which is a BRANCH, and a branch resolves for the wrong reason.
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': enWithFamily,
      'packages/x/src/A.tsx': `import { useObjectTranslation } from '${I18N_PKG}';
export const A = (k: string) => {
  const { t } = useObjectTranslation();
  return [t(\`badge.\${k}.short\`), t(\`badge.\${k}.body\`)];
};
`,
      'packages/x/src/vocab.ts': `export type Badge = 'alpha' | 'beta';\n`,
    });
    const families: Family[] = [{ head: 'badge.', vocabulary: { module: 'packages/x/src/vocab.ts', name: 'Badge', kind: 'union' } }];
    const { findings, counters } = analyze(root, { families });
    expect(findings.map((f: { detail: string }) => f.detail).sort()).toEqual(['badge.alpha.body', 'badge.beta.body']);
    // Two tails x two members: the `.short` pair resolves, the `.body` pair does not.
    expect(counters.checkedMembers).toBe(4);
  });

  it('declines to expand a MULTI-substitution template, and counts it instead of guessing', () => {
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': enWithFamily,
      'packages/x/src/A.tsx': `import { useObjectTranslation } from '${I18N_PKG}';
export const A = (a: string, b: string) => { const { t } = useObjectTranslation(); return t(\`mode.\${a}.\${b}\`); };
`,
      'packages/x/src/vocab.ts': `export type Mode = 'day' | 'week';\n`,
    });
    const families: Family[] = [{ head: 'mode.', vocabulary: { module: 'packages/x/src/vocab.ts', name: 'Mode', kind: 'union' } }];
    const { findings, counters } = analyze(root, { families });
    expect(findings).toEqual([]);
    expect(counters.unexpandableFamilySites).toBe(1);
    expect(counters.checkedMembers).toBe(0);
  });

  it('a family declared `enumerable: false` keeps its prefix check and gains nothing else', () => {
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': enWithFamily,
      'packages/x/src/A.tsx': callSite('mode.${x}'),
    });
    const families: Family[] = [{ head: 'mode.', enumerable: false, why: 'runtime-data', reason: 'server-supplied' }];
    const { findings, counters } = analyze(root, { families });
    expect(findings).toEqual([]);
    expect(counters.notEnumerableFamilies).toBe(1);
    expect(counters.checkedMembers).toBe(0);
  });
});

describe('the family registry is a ratchet in both directions (objectui#4964)', () => {
  const EN_MODE = `const en = { mode: { day: 'Day' } } as const;\nexport default en;\n`;
  const CALL = `import { useObjectTranslation } from '${I18N_PKG}';
export const A = (x: string) => { const { t } = useObjectTranslation(); return t(\`mode.\${x}\`); };
`;

  it('an UNDECLARED family fails — a new template family cannot land unguarded', () => {
    const root = repoWith({ 'packages/i18n/src/locales/en.ts': EN_MODE, 'packages/x/src/A.tsx': CALL });
    expect(findingsOf(root, 'undeclared-dynamic-family')).toEqual(['mode.@packages/x/src/A.tsx:2']);
  });

  it('a STALE entry fails too, so the registry can only describe families that exist', () => {
    const root = repoWith({ 'packages/i18n/src/locales/en.ts': EN_MODE });
    const families: Family[] = [{ head: 'gone.', enumerable: false, why: 'runtime-data', reason: 'x' }];
    const reasons = analyze(root, { families }).findings.map((f: { reason: string }) => f.reason);
    expect(reasons).toEqual(['stale-dynamic-family']);
  });

  it('two entries for one head fail rather than letting the second sit dead', () => {
    const root = repoWith({ 'packages/i18n/src/locales/en.ts': EN_MODE, 'packages/x/src/A.tsx': CALL });
    const families: Family[] = [
      { head: 'mode.', enumerable: false, why: 'runtime-data', reason: 'first' },
      { head: 'mode.', enumerable: false, why: 'runtime-data', reason: 'second' },
    ];
    expect(analyze(root, { families }).findings.map((f: { reason: string }) => f.reason)).toEqual(['duplicate-family']);
  });

  it('a vocabulary that resolves to NOTHING fails — vacuous and passing read identically', () => {
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': EN_MODE,
      'packages/x/src/A.tsx': CALL,
      'packages/x/src/vocab.ts': `export const MODES: string[] = [];\n`,
    });
    const families: Family[] = [{ head: 'mode.', vocabulary: { module: 'packages/x/src/vocab.ts', name: 'MODES', kind: 'array' } }];
    expect(findingsOf(root, 'empty-vocabulary', families)).toEqual(['mode.@packages/x/src/A.tsx:2']);
  });

  it('a vocabulary that moved, was renamed, or changed shape fails instead of degrading to zero members', () => {
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': EN_MODE,
      'packages/x/src/A.tsx': CALL,
      'packages/x/src/vocab.ts': `export const MODES = buildModes();\n`,
    });
    // A module that is not there at all, and a declaration whose initializer is
    // a call rather than a literal — both are "cannot read", never "read as none".
    const missing: Family[] = [{ head: 'mode.', vocabulary: { module: 'packages/x/src/nope.ts', name: 'MODES', kind: 'array' } }];
    expect(analyze(root, { families: missing }).findings.map((f: { reason: string }) => f.reason)).toEqual([
      'unreadable-vocabulary',
    ]);
    const derived: Family[] = [{ head: 'mode.', vocabulary: { module: 'packages/x/src/vocab.ts', name: 'MODES', kind: 'array' } }];
    expect(analyze(root, { families: derived }).findings.map((f: { reason: string }) => f.reason)).toEqual([
      'unreadable-vocabulary',
    ]);
  });
});

describe('readVocabulary reads each declared shape, and refuses what it cannot read', () => {
  const shapes: Array<[string, string, Omit<Spec, 'module'>, string[]]> = [
    ['union', "export type X = 'a' | 'b';", { kind: 'union', name: 'X' }, ['a', 'b']],
    ['single-member union', "export type X = 'a';", { kind: 'union', name: 'X' }, ['a']],
    ['array', "export const X = ['a', 'b'] as const;", { kind: 'array', name: 'X' }, ['a', 'b']],
    ['set', "export const X = new Set(['a', 'b']);", { kind: 'set', name: 'X' }, ['a', 'b']],
    ['objectKeys', "export const X = { a: 1, 'b': 2 };", { kind: 'objectKeys', name: 'X' }, ['a', 'b']],
    ['arrayField', "export const X = [{ value: 'a' }, { value: 'b' }];", { kind: 'arrayField', name: 'X', field: 'value' }, ['a', 'b']],
    ['objectField', "export const X = { one: { k: 'a' }, two: { k: 'b' } };", { kind: 'objectField', name: 'X', field: 'k' }, ['a', 'b']],
    ['interfaceField', "export interface X { f: 'a' | 'b'; g: string }", { kind: 'interfaceField', name: 'X', field: 'f' }, ['a', 'b']],
    ['type-literal field', "export type X = { f: 'a' | 'b' };", { kind: 'interfaceField', name: 'X', field: 'f' }, ['a', 'b']],
  ];
  for (const [label, source, spec, expected] of shapes) {
    it(`reads a ${label}`, () => {
      const root = repoWith({ 'packages/x/src/v.ts': `${source}\n` });
      expect(readVocabulary(root, { module: 'packages/x/src/v.ts', ...spec })).toEqual(expected);
    });
  }

  const refusals: Array<[string, string, Omit<Spec, 'module'>]> = [
    ['a union with a non-literal arm', 'export type X = "a" | number;', { kind: 'union', name: 'X' }],
    ['an array holding a non-literal', 'export const X = ["a", other];', { kind: 'array', name: 'X' }],
    ['an object built by spread', 'export const X = { ...base, a: 1 };', { kind: 'objectKeys', name: 'X' }],
    ['a name that is not declared here', 'export const Y = ["a"];', { kind: 'array', name: 'X' }],
    ['an interface field that is not a literal union', 'export interface X { f: string }', { kind: 'interfaceField', name: 'X', field: 'f' }],
  ];
  for (const [label, source, spec] of refusals) {
    it(`refuses ${label} rather than reading it as empty`, () => {
      const root = repoWith({ 'packages/x/src/v.ts': `${source}\n` });
      expect(readVocabulary(root, { module: 'packages/x/src/v.ts', ...spec })).toBeNull();
    });
  }
});

describe('the checked-in registry describes this repo (objectui#4964)', () => {
  it('every family declares exactly one of a vocabulary or a reason it has none', () => {
    const WHY = new Set(['runtime-data', 'external-vocabulary', 'unnamed-union', 'open-forwarder']);
    for (const family of DYNAMIC_KEY_FAMILIES) {
      expect(family.head, 'a head must end at a member boundary').toMatch(/\.$/);
      if (family.enumerable === false) {
        expect(WHY, `${family.head}: unknown \`why\``).toContain(family.why);
        expect(family.reason!.length, `${family.head}: a reason must actually say something`).toBeGreaterThan(40);
        expect(family.vocabulary).toBeUndefined();
      } else {
        expect(family.vocabulary, `${family.head}: neither a vocabulary nor \`enumerable: false\``).toBeTruthy();
      }
    }
  });

  it('every declared vocabulary resolves to a NON-EMPTY member set on this checkout', () => {
    // The registry-wide non-vacuity assertion. A vocabulary that stopped
    // resolving would leave the gate green while checking less, which is the
    // one regression this class could introduce.
    for (const family of DYNAMIC_KEY_FAMILIES) {
      if (family.enumerable === false) continue;
      const spec = family.vocabulary!;
      const members = readVocabulary(repoRoot, spec);
      expect(members, `${family.head}: ${spec.name} is unreadable`).not.toBeNull();
      expect((members as string[]).length, `${family.head}: resolved to zero members`).toBeGreaterThan(0);
    }
  });

  it('the split is what the report says it is, and the check is not vacuous on `main`', () => {
    const { counters, findings } = analyze(repoRoot);
    expect(counters.declaredFamilies).toBe(DYNAMIC_KEY_FAMILIES.length);
    expect(counters.enumerableFamilies + counters.notEnumerableFamilies).toBe(counters.declaredFamilies);
    // Measured on `main`: 18 of 25 families are exactly checkable. The number is
    // pinned low rather than exactly so paying off a `unnamed-union` or
    // `external-vocabulary` entry raises coverage without failing this test —
    // but LOSING coverage does fail it.
    expect(counters.enumerableFamilies).toBeGreaterThanOrEqual(18);
    expect(counters.checkedMembers).toBeGreaterThanOrEqual(112);
    // Neither ratchet direction may be firing on a clean checkout.
    const ratchet = findings.filter((f: { reason: string }) =>
      ['undeclared-dynamic-family', 'stale-dynamic-family', 'duplicate-family', 'empty-vocabulary', 'unreadable-vocabulary'].includes(
        f.reason,
      ),
    );
    expect(ratchet, 'the registry no longer describes the repo').toEqual([]);
  });

  it('finds a known-PRESENT member — the positive control for every "not found" above', () => {
    // Proves the expansion reaches real `en` leaves. `gantt.viewMode.day` is
    // defined; if the checker could not see it, every green family above would
    // be green for the wrong reason.
    const { leaves } = collectEnKeys(repoRoot);
    expect(leaves.has('gantt.viewMode.day'), 'the fixture key this control rests on has moved').toBe(true);
    const viewMode = DYNAMIC_KEY_FAMILIES.find((f) => f.head === 'gantt.viewMode.');
    expect(readVocabulary(repoRoot, viewMode!.vocabulary!)).toContain('day');
    expect(analyze(repoRoot).findings.filter((f: { detail: string }) => f.detail === 'gantt.viewMode.day')).toEqual([]);
  });
});

describe('the baseline is a ratchet', () => {
  const finding = (reason: string, detail: string) => ({ reason, detail, file: 'f.tsx', line: 1, column: 1 });

  it('lets a declared key through and stops an undeclared one', () => {
    const baseline = { missingKeys: { 'known.gap': { issue: 'objectui#3546' } }, missingPrefixes: {} };
    const { unexpected, stale } = applyBaseline(
      [finding('missing-key', 'known.gap'), finding('missing-key', 'brand.new')],
      baseline,
    );
    expect(unexpected.map((f: { detail: string }) => f.detail)).toEqual(['brand.new']);
    expect(stale).toEqual([]);
  });

  it('fails on an entry whose defect is gone, so the file can only shrink', () => {
    const baseline = {
      missingKeys: { 'fixed.key': { issue: 'objectui#3546' } },
      missingPrefixes: { 'fixed.family.': { issue: 'objectui#3546' } },
    };
    const { unexpected, stale } = applyBaseline([], baseline);
    expect(unexpected).toEqual([]);
    expect(stale).toEqual([
      { kind: 'missingKeys', entry: 'fixed.key' },
      { kind: 'missingPrefixes', entry: 'fixed.family.' },
    ]);
  });

  it('the checked-in baseline is exactly what `main` still owes — no spare entries', () => {
    // A stale entry here would mean the gate is carrying a fix that already
    // landed, which is how a ratchet turns back into an allowlist.
    const baselineFile = path.join(repoRoot, 'scripts/i18n-call-site-key-baseline.json');
    const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
    const { unexpected, stale } = applyBaseline(analyze(repoRoot).findings, baseline);
    expect(unexpected, `${unexpected.length} call site(s) not covered by the baseline`).toEqual([]);
    expect(stale, `${stale.length} stale baseline entr(y|ies)`).toEqual([]);
    for (const entry of Object.values(baseline.missingKeys) as Array<{ issue: string }>) {
      expect(entry.issue).toMatch(/^objectui#\d+$/);
    }
  });
});

describe('the gate is wired to run', () => {
  it('package.json exposes it as a named script', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    expect(pkg.scripts['check:i18n-keys']).toBe('node scripts/check-i18n-call-site-keys.mjs');
  });

  it('ci.yml runs it after the install it needs (it imports typescript)', () => {
    const ci = fs.readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
    const install = ci.indexOf('pnpm install --frozen-lockfile');
    const step = ci.indexOf('pnpm check:i18n-keys');
    expect(step, 'ci.yml does not run `pnpm check:i18n-keys`').toBeGreaterThan(-1);
    expect(step, 'the check runs before dependencies are installed').toBeGreaterThan(install);
  });
});
