import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

import {
  APP_DOCS as FENCE_APP_DOCS,
  census,
  listDocuments as fenceDocuments,
  ROOT_PAGES as FENCE_ROOT_PAGES,
  TS_FENCE_LANGUAGES as GUARD_TS_FENCES,
} from '../check-doc-fence-languages.mjs';
import {
  APP_DOCS as SNIPPET_APP_DOCS,
  listDocuments as snippetDocuments,
  ROOT_PAGES as SNIPPET_ROOT_PAGES,
  TS_FENCE_LANGUAGES as GATE_TS_FENCES,
} from '../check-doc-snippet-types.mjs';
import {
  APP_DOCS as COMPONENT_APP_DOCS,
  ROOT_PAGES as COMPONENT_ROOT_PAGES,
} from '../check-doc-component-types.mjs';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const GUARD = 'scripts/check-doc-fence-languages.mjs';
const WORKFLOW = 'doc-fence-languages.yml';

/**
 * A numeral that qualifies a document-population noun, as `match: text`.
 *
 * Lifted to module scope by objectui#7914 so the pin below and its positive
 * control read ONE definition of the rule. Two copies of the same rule inside
 * one file is a defect this repository has paid for repeatedly; the pattern
 * itself is unchanged, character for character, from what this pin carried
 * inline (objectui#7888) and from the third copy in
 * `check-links-workflow.test.ts` (objectui#7825). WHY it is narrow exactly here
 * — the two intervening words, the negative lookbehind that rules out issue
 * references — is argued at the pin, and deliberately not restated here.
 *
 * A fresh `RegExp` per call: `lastIndex` on a shared global literal is exactly
 * the kind of state that makes the second caller in a run measure something
 * different from the first.
 */
const POPULATION_COUNT =
  /(?<![#\w.])\d+(?:,\d{3})*\s+(?:[A-Za-z][\w-]*\s+){0,2}`?(?:\.mdx|\.md|documents?|pages?|docs?|files?)\b/i;

function documentCounts(text: string): string[] {
  return [...text.matchAll(new RegExp(POPULATION_COUNT.source, 'gi'))].map((m) => m[0].replace(/\s+/g, ' ').trim());
}

/**
 * objectui#6135. `check-doc-snippet-types` reads `ts` / `tsx` / `typescript`
 * fences, so a TypeScript block fenced any other way is invisible to it, and
 * objectui#5867's remediation lane collected its population from `plaintext`
 * fences only — one spelling of an unhighlighted fence out of several. A
 * ```text block opening `interface FileUploadSchema {` was outside both.
 *
 * `check-doc-fence-languages.mjs` closes that by reading BODIES rather than
 * pinning a list of languages. This file pins the two things its correctness
 * rests on and cannot check about itself:
 *
 *   1. **The scan surface really is the gate's.** The guard re-implements
 *      `listDocuments` so it needs no `pnpm install` — the gate imports
 *      `typescript`, and an install-gated docs check is one a docs-only pull
 *      request skips, which is the hole `doc-component-types.yml`'s header
 *      records. A copy that is never compared is a copy free to drift, and the
 *      drift direction is silent: a document the guard stops walking is a
 *      document nothing reports on. So both walks are imported and compared.
 *   2. **The wiring.** A gate nobody runs is indistinguishable from a gate that
 *      passes (`entry-guard-wiring.test.ts` records that lesson for its own
 *      subject). The alias, the workflow, the self-test leg and the
 *      unfiltered triggers are asserted here.
 *
 * Deliberately NOT asserted: the size of the baseline or the number of blocks it
 * carries. Those move with every objectui#5867 batch, and a hand-copied
 * enumeration in a test drifts by construction — the lesson `lint-workflow.test.ts`
 * records for this repository at length. The guard's own output is the honest
 * place for those numbers.
 */
describe('check-doc-fence-languages: the scan surface is check-doc-snippet-types’s', () => {
  it('walks exactly the documents the snippet gate walks', () => {
    expect(fenceDocuments(ROOT)).toEqual(snippetDocuments(ROOT));
  });

  it('…and that is a non-empty set, so the comparison is not vacuous', () => {
    expect(fenceDocuments(ROOT).length).toBeGreaterThan(100);
  });

  it('treats exactly the snippet gate’s fence languages as already-covered', () => {
    expect([...GUARD_TS_FENCES].sort()).toEqual([...GATE_TS_FENCES].sort());
  });

  /**
   * objectui#7115 — the ROOT_PAGES half of the surface, pinned across ALL THREE
   * doc gates rather than two.
   *
   * The document-list assertion above is what caught this: objectui#7115 widened
   * `check-doc-component-types` and `check-doc-snippet-types` onto the root
   * `README.md` — the two gates its ruling named — and this file went red,
   * because a third gate is coupled to that surface by construction. The lists
   * are equal again, but list equality alone would not have said WHERE they
   * diverged, and `check-doc-component-types`'s surface is deliberately narrower
   * (it does not walk the package READMEs), so it cannot join that comparison.
   *
   * This is the piece all three DO share. Each carries its own copy for its own
   * install-free reason; comparing the copies is what keeps "copy freely" honest.
   */
  it('all three doc gates carry the same ROOT_PAGES — the surface objectui#7115 widened', () => {
    expect([...FENCE_ROOT_PAGES]).toEqual(['README.md']);
    expect([...SNIPPET_ROOT_PAGES]).toEqual([...FENCE_ROOT_PAGES]);
    expect([...COMPONENT_ROOT_PAGES]).toEqual([...FENCE_ROOT_PAGES]);
  });

  it('the root README is really in this gate’s walk — the widening, pinned', () => {
    // Not implied by the equality above: both lists could lose it together.
    expect(fenceDocuments(ROOT)).toContain('README.md');
  });

  /**
   * objectui#6600 — the `apps/<app>/docs/**` half of the surface.
   *
   * The equality assertion above does NOT cover this: both walks could drop the
   * tree together and stay equal, which is precisely the state this card was
   * filed about — three gates agreeing with each other about a tree none of them
   * opened. `check-doc-component-types`' own header states the rule these two
   * assertions implement: "Widening a scan surface is the change that can be
   * GREEN ABOUT NOTHING… Anything added here later is owed the same proof."
   *
   * So membership is pinned by NAME, and the shared constant is pinned across all
   * three gates the way `ROOT_PAGES` is.
   */
  it('all three doc gates carry the same APP_DOCS — the surface objectui#6600 widened', () => {
    expect(FENCE_APP_DOCS).toEqual({ dir: 'apps', subdir: 'docs' });
    expect(SNIPPET_APP_DOCS).toEqual(FENCE_APP_DOCS);
    expect(COMPONENT_APP_DOCS).toEqual(FENCE_APP_DOCS);
  });

  it('the apps/*/docs guides are really in the walk — the widening, pinned', () => {
    const docs = fenceDocuments(ROOT);
    expect(docs).toContain('apps/console/docs/deployment.md');
    expect(docs).toContain('apps/console/docs/error-tracking.md');
    expect(docs).toContain('apps/console/docs/UI_IMPROVEMENT_PROPOSAL.md');
  });

  /**
   * The walk takes ONE app-directory level before the `docs` segment, rather
   * than any depth. `apps/site/app/docs` is a Next.js route directory;
   * collecting it would be collecting routes, and the
   * only reason nothing breaks today is that it holds `.tsx` rather than `.md`.
   * Pinned so a later "make the glob more general" edit has to argue with a test.
   */
  it('does not descend into nested route directories that happen to be named docs', () => {
    expect(fenceDocuments(ROOT).filter((d) => d.startsWith('apps/site/'))).toEqual([]);
  });
});

describe('check-doc-fence-languages: non-vacuity, through the shipped module', () => {
  const TS_BODY = 'interface FileUploadSchema {\n  accept?: string;\n}';
  const doc = (info: string, body: string = TS_BODY) => [
    { rel: 'probe.mdx', source: ['```' + info, body, '```'].join('\n') },
  ];
  const modes = (info: string, body?: string) =>
    census(doc(info, body)).sites.map((s: { mode: string }) => s.mode);

  // The three spellings the 2026-08-24 ruling on objectui#6135 named by hand.
  it.each(['text', 'txt', ''])('a TypeScript block fenced %o is found', (info) => {
    expect(modes(info)).toEqual(['synonym']);
  });

  it('names the file and the fence line, rather than only counting', () => {
    const [site] = census(doc('text')).sites;
    expect(site).toMatchObject({ rel: 'probe.mdx', line: 1, language: 'text', mode: 'synonym' });
  });

  it.each(['ts', 'tsx', 'typescript'])('the same block fenced %o is not a finding', (info) => {
    expect(modes(info)).toEqual([]);
  });

  it('a spelling nobody has thought of is the OTHER failure mode', () => {
    expect(modes('console')).toEqual(['unknown']);
  });

  it('prose under an unhighlighted fence is not a finding — the classifier is quoted, not widened', () => {
    expect(modes('plaintext', 'Upload a file, then press Save.')).toEqual([]);
  });
});

describe('check-doc-fence-languages is wired, not merely present', () => {
  const workflow = parseYaml(fs.readFileSync(path.join(ROOT, '.github/workflows', WORKFLOW), 'utf8'));
  const steps: Array<Record<string, unknown>> = workflow.jobs['doc-fence-languages'].steps;
  const gateSteps = steps.filter((s) => typeof s.run === 'string' && (s.run as string).includes(GUARD));

  it('the guard script exists', () => {
    expect(fs.existsSync(path.join(ROOT, GUARD))).toBe(true);
  });

  it('package.json aliases it, and the alias points at the script that exists', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts['check:doc-fences']).toContain(GUARD);
  });

  it('the workflow runs it — one step, both legs', () => {
    expect(gateSteps).toHaveLength(1);
    const run = gateSteps[0].run as string;
    expect(run).toContain(`node ${GUARD} --self-test`);
    expect(run.split('\n').some((l) => l.trim() === `node ${GUARD}`)).toBe(true);
  });

  it('one gate, one home — no other workflow runs the same script', () => {
    const dir = path.join(ROOT, '.github/workflows');
    const others = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.yml') && f !== WORKFLOW)
      .filter((f) => fs.readFileSync(path.join(dir, f), 'utf8').includes(GUARD));
    expect(others).toEqual([]);
  });

  it('has no paths filter — the defect it catches arrives in a docs-only pull request', () => {
    // `on` parses as the boolean `true` in YAML 1.1; `yaml` gives back `on`.
    const on = workflow.on ?? workflow[true as unknown as string];
    expect(Object.keys(on)).toContain('pull_request');
    expect(on.pull_request).not.toHaveProperty('paths');
    expect(on.pull_request).not.toHaveProperty('paths-ignore');
  });

  it('subscribes to the merge queue, so it cannot stall one if it becomes required', () => {
    const on = workflow.on ?? workflow[true as unknown as string];
    expect(Object.keys(on)).toContain('merge_group');
  });

  it('needs no install — nothing in the job runs pnpm', () => {
    const runs = steps.map((s) => (typeof s.run === 'string' ? s.run : '')).join('\n');
    expect(runs).not.toContain('pnpm');
  });

  it('its self-test passes — the half that makes a green scan mean something', () => {
    const out = execFileSync('node', [GUARD, '--self-test'], { cwd: ROOT, encoding: 'utf8' });
    expect(out).toMatch(/check-doc-fence-languages self-test: \d+ cases pass/);
  });

  /**
   * objectui#7448. The header of this workflow described its scan surface as
   * "the same 222 documents `check-doc-snippet-types` covers". The walk held 227
   * when this pin was written, and NO check went red over the whole distance
   * between the two — a count copied into a comment drifts by
   * construction, which is the same reason the file header above declines to
   * assert the size of the baseline, and the same fix `UNGATED_DOCS`'s header
   * records being applied to itself ("a pointer to the list now rather than a
   * copy of its length").
   *
   * Changing 222 to 227 would only have restarted that clock. This is what makes
   * the class fail loudly instead: the header may state the population, never
   * count it. `doc-component-types.yml` carries the twin of this pin in
   * `check-doc-component-types.test.ts` — one gate, one home, so each workflow's
   * header is asserted beside its own gate rather than in a shared sweep.
   *
   * Deliberately narrow, and narrow in the same place as the other two copies:
   * a numeral qualifying a document-population noun, with at most two words
   * allowed to sit between the two. Issue references (ruled out at the pattern
   * level by the negative lookbehind, not by luck), `node-version`,
   * `timeout-minutes` and "the sixth instance of the same shape" are all
   * numbers this header legitimately carries, and none of them rots when a
   * document is added or deleted. That is
   * also why the header must not quote another header's stale literal verbatim
   * — this pin cannot tell a quotation from a claim, and the safe direction for
   * a check on prose accuracy is to refuse both.
   *
   * ⭐ Those two intervening words are objectui#7888, and they are the sentence
   * above implemented rather than a new rule. This pin and its twin in
   * `check-doc-component-types.test.ts` both said "a numeral DIRECTLY
   * qualifying" and both coded it as strict adjacency, so a single adjective
   * defeated them. Measured: run verbatim over `check-links.yml`'s header as it
   * stood on `origin/main` at `83fe6e741` — a header carrying TWO live drifted
   * counts — the adjacent-only pattern reported ONE of them. It found the
   * sentence about the files the published site is built from, and scored the
   * one reading "holds 15 INTERNAL documents" clean — which was the count that
   * had drifted furthest (15 against a measured 17), because an adjective sat
   * between the numeral and the noun. The pattern below is the third copy's,
   * carried here verbatim (objectui#7825, PR objectui#7885,
   * `check-links-workflow.test.ts`), with the noun set unchanged; the word
   * DIRECTLY is gone from the sentence above because keeping it would only have
   * inverted the same gap between what this pin claims and what it does.
   *
   * Both twin headers were clean under BOTH patterns when this was carried
   * across, so this closes a proven hole rather than a live violation.
   *
   * Only the negative half is asserted. A positive assertion ("the header names
   * the verdict line") would pin a wording, and pinned wording is the thing this
   * file already refuses to do elsewhere; what has to stay true is that no
   * number is written here that a document being added would falsify.
   */
  it('its header states the population and never counts it — no count can rot here', () => {
    const header = fs
      .readFileSync(path.join(ROOT, '.github/workflows', WORKFLOW), 'utf8')
      .split('\n')
      .filter((line) => /^\s*#/.test(line))
      .join('\n');
    const counts = documentCounts(header);
    expect(
      counts,
      `${WORKFLOW}'s header states a document count (${counts.join(', ')}). Nothing fails when it ` +
        'drifts, so it will. State the population — or point at the gate\u2019s own verdict line, which ' +
        'prints the live figure on every run — instead of copying a number into a comment (objectui#7448).',
    ).toEqual([]);
  });

  /**
   * The positive control for the pin above — objectui#7914.
   *
   * A pin that cannot fail is not a pin, and this repository has shipped one
   * with zero demonstrated power before (objectui#7466: 0/32 on the broken tree
   * AND 0/32 on the fixed one). This header carries no count today, so the pin
   * above asserts `[] toEqual []` — and would assert exactly that if the pattern
   * were deleted, reversed, or narrowed back to adjacency. Nothing in this file
   * exercised the claim, which is why objectui#7888 had to demonstrate its own
   * widening out of band, in a pull request description this repository does not
   * hold. The shapes that actually rotted are fixtured here as POSITIVES rather
   * than trusted to a reading of the regex. The block is carried from the third
   * copy's control in `check-links-workflow.test.ts`, which has held this shape
   * since objectui#7825 — one shape, three homes, so none of them may drift.
   *
   * The first entry is this header's own pre-fix sentence, verbatim; two more
   * are what its twin and the third copy said. `15 INTERNAL documents` is the
   * direction objectui#7888 turned on, and it is measured, not assumed: run over
   * that line, the adjacency-only pattern this pin used to carry returns `[]`,
   * because one adjective sat between the numeral and the noun.
   *
   * ⭐ Two entries state a number that is CORRECT TODAY — this gate's own verdict
   * line reported `227 document(s)` on the day this control was written. They are
   * rejected anyway, and that is the entire point: the rule governs the WRITING,
   * not one wrong figure. A control that only rejected stale numbers would wave
   * the same trap through on the day the number happens to be right, which is
   * precisely the day it starts rotting again.
   *
   * The negatives are numbers this header legitimately carries. The first is a
   * MEASURED false positive of the pre-objectui#7888 pattern: run over
   * `#7448 documents the rule`, it returned `["7448 documents"]` — an issue
   * reference read as a document count. The negative lookbehind rules that out at
   * the pattern level now, and this fixture is what keeps it ruled out.
   */
  it('the count pin fires on the shapes that rotted, and on none of the numbers a header may keep', () => {
    const rotted = [
      'the same 222 documents `check-doc-snippet-types` covers',
      'the same 227 documents `check-doc-snippet-types` covers',
      'every TypeScript block in 227 covered documents is fenced ts/tsx/typescript',
      '80 declared file(s) carrying 89 block(s)',
      'the repo-root `docs/**`, which holds 15 INTERNAL documents (ADRs, audits), while',
      '184 pages (144 `.mdx` + 40 `.md`)',
      'roughly 1,204 markdown files under the two trees',
    ];
    for (const line of rotted) {
      expect(documentCounts(line), `${WORKFLOW}'s count pin must fire on: ${line}`).not.toEqual([]);
    }

    const legitimate = [
      '#7448 documents the rule this gate enforces',
      'objectui#5342 documents the `.md` widening',
      'objectui#5867, whose remediation lane collected its population',
      '#3213 to #3448 spent inside the `ci.yml` docs job',
      'this is the sixth instance of the same shape',
      'objectui#6135 measured a ```text block outside both',
      'node-version: 22',
      'timeout-minutes: 10',
      'the ruleset 60-minute timeout fails it',
    ];
    for (const line of legitimate) {
      expect(documentCounts(line), `${WORKFLOW}'s count pin must NOT fire on: ${line}`).toEqual([]);
    }
  });
});
