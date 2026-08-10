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
  PACK_HOOK,
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
} as const;
export default en;
`;

/** Findings of `reason` produced for a synthetic repo, as `key@file:line`. */
function findingsOf(root: string, reason: string): string[] {
  return analyze(root)
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
    const { findings, counters } = analyze(root);
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

  it('a fully computed key is counted and left alone — there is no head to judge', () => {
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': EN_FIXTURE,
      'packages/x/src/A.tsx': `import { useObjectTranslation } from '${I18N_PKG}';
export const A = (k: string) => { const { t } = useObjectTranslation(); return t(k); };
`,
    });
    const { findings, counters } = analyze(root);
    expect(findings).toEqual([]);
    expect(counters.dynamicKeySites).toBe(1);
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
    const { findings, counters } = analyze(root);
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
    const { findings, counters } = analyze(root);
    expect(findings).toEqual([]);
    expect(counters.skippedLocalTable).toBeGreaterThanOrEqual(2);
    expect(counters.packCallSites).toBe(0);
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
    const { findings, counters } = analyze(root);
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
    return analyze(root)
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
    const { findings, counters } = analyze(root);
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
    expect(analyze(root).findings.map((f: { reason: string }) => f.reason)).toEqual(['missing-key']);
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
    const { findings, counters } = analyze(root);
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
    const { findings, counters } = analyze(root);
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
