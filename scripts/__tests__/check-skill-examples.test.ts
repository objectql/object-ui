import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Plain-JS CI helper. Its types are INFERRED from the .mjs source by
// `tsconfig.scripts.json` (`allowJs`), so no `@ts-expect-error` here —
// re-adding one is now itself an error (TS2578). See objectui#3494.
import {
  EXIT_CODES,
  JSON_FENCE_LANGUAGES,
  KNOWN_BARE_ANY_EXAMPLES,
  MARKER,
  SCAN_ROOTS,
  TS_FENCE_LANGUAGES,
  bareAnyRowKey,
  buildFilterArgs,
  fenceSpans,
  findBareAny,
  listGuides,
  parseJsonFence,
  scanSkillFences,
  stripJsonComments,
} from '../check-skill-examples.mjs';

/**
 * objectui#7359 — the test for `scripts/check-skill-examples.mjs`.
 *
 * ## What this file covers, and what it deliberately leaves to `--self-test`
 *
 * Everything here runs on an UNBUILT tree: the fence scanner, the marker
 * convention, the JSON dialects, and the wiring. That boundary is not tidiness —
 * this suite runs inside `ci.yml`'s `Test (shard N/4)` jobs, which do not build
 * the workspace, and a test that needed `dist/*.d.ts` would either be flaky or
 * would quietly assert nothing there.
 *
 * The compiler half — a marked fence that holds up is clean, a marked fence with
 * a type error is red, an unparseable one is a SYNTAX failure and does not blind
 * the semantic phase for the rest — lives in the script's own `--self-test`,
 * which the workflow runs AFTER the build, and which refuses with
 * `PRECONDITION NOT MET` (exit 2) rather than skipping if the tree is not built.
 * `wiring` below pins that the workflow really runs it, because a probe nobody
 * runs is indistinguishable from a probe that passes.
 *
 * The fixtures are strings and throwaway trees, never the real guides: a
 * committed fixture guide would have to contain a deliberately broken example,
 * and something else in this repository would eventually scan it — the reasoning
 * `check-skills-paths.test.ts` states for its own trees.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Builds a throwaway tree and hands the caller its root. */
function withTree<T>(
  build: (write: (rel: string, contents: string) => void) => void,
  run: (dir: string) => T,
): T {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-skill-examples-'));
  const write = (rel: string, contents: string) => {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents);
  };
  try {
    build(write);
    return run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

type Fence = { kind: string; language: string; fenceLine: number; body: string; marked: boolean };
type Scan = { fences: Fence[]; orphans: number[] };

describe('the marker, and what it opts in', () => {
  it('is the exact spelling objectstack uses — the convention is one convention', () => {
    // Byte-for-byte. A near-spelling would be a second convention that looks
    // like the first, and the orphan scan below is what makes the difference
    // loud instead of silent.
    expect(MARKER).toBe('<!-- os:check -->');
  });

  it('opts in the fence on the line DIRECTLY below it', () => {
    const scan: Scan = scanSkillFences([MARKER, '```typescript', 'export const a = 1;', '```'].join('\n'));
    expect(scan.fences).toHaveLength(1);
    expect(scan.fences[0].marked).toBe(true);
    expect(scan.fences[0].fenceLine).toBe(2);
    expect(scan.fences[0].body).toBe('export const a = 1;');
    expect(scan.orphans).toEqual([]);
  });

  it('does NOT reach across a blank line — that marker is an orphan', () => {
    // The rule that costs nothing to keep strict and everything to relax. A
    // marker one blank line away opts in NOTHING, and under a lenient
    // "nearest non-blank line above" rule the author would never learn that.
    const scan: Scan = scanSkillFences([MARKER, '', '```typescript', 'export const a = 1;', '```'].join('\n'));
    expect(scan.fences[0].marked).toBe(false);
    expect(scan.orphans).toEqual([1]);
  });

  it('reports a marker above a fence it cannot judge as an orphan', () => {
    const scan: Scan = scanSkillFences([MARKER, '```bash', 'pnpm install', '```'].join('\n'));
    expect(scan.fences).toEqual([]);
    expect(scan.orphans).toEqual([1]);
  });

  it('reports a marker left behind above prose', () => {
    const scan: Scan = scanSkillFences(['# Guide', '', MARKER, '', 'Some prose.'].join('\n'));
    expect(scan.orphans).toEqual([3]);
  });

  it('ignores leading and trailing whitespace on the marker line', () => {
    const scan: Scan = scanSkillFences([`  ${MARKER}  `, '```json', '{"a":1}', '```'].join('\n'));
    expect(scan.fences[0].marked).toBe(true);
    expect(scan.orphans).toEqual([]);
  });

  it('does not accept a marker with anything else on its line', () => {
    const scan: Scan = scanSkillFences([`${MARKER} and more`, '```json', '{"a":1}', '```'].join('\n'));
    expect(scan.fences[0].marked).toBe(false);
    // ...and it is not an orphan either: it is not the marker, it is prose that
    // contains it. Only the exact line makes a claim.
    expect(scan.orphans).toEqual([]);
  });
});

describe('fence-awareness — a marker shown as example text claims nothing', () => {
  /**
   * This gate's convention has to be documentable in the very guides it
   * governs, and in this file. So the two questions the walk answers — "is this
   * marker at top level?" and "does this line open a fence?" — read one array,
   * and a nested illustration is neither an opt-in nor an orphan.
   */
  it('extracts nothing from a fully worked illustration inside a wrapper fence', () => {
    const scan: Scan = scanSkillFences(
      ['````markdown', MARKER, '```typescript', 'const illustrative = 1;', '```', '````'].join('\n'),
    );
    expect(scan.fences).toEqual([]);
    expect(scan.orphans).toEqual([]);
  });

  it('extracts everything from the identical payload when it is NOT nested', () => {
    // The control on the case above: without it, a walk that extracted nothing
    // for the wrong reason would pass.
    const scan: Scan = scanSkillFences([MARKER, '```typescript', 'const illustrative = 1;', '```'].join('\n'));
    expect(scan.fences).toHaveLength(1);
    expect(scan.fences[0].marked).toBe(true);
  });

  it('reads the fence body to the closing line the SAME walk chose', () => {
    const { owners, closeOf } = fenceSpans(['```ts', 'a', '```', 'top level'].join('\n').split('\n'));
    expect(owners).toEqual([0, 0, 0, -1]);
    expect(closeOf.get(0)).toBe(2);
  });

  it('lets an unclosed fence run to end of file rather than throwing', () => {
    const scan: Scan = scanSkillFences(['```typescript', 'const a = 1;', '', '# still inside'].join('\n'));
    expect(scan.fences).toHaveLength(1);
    expect(scan.fences[0].body).toBe('const a = 1;\n\n# still inside');
  });

  it('normalises CRLF, so no regex has to decide whether \\s matches a carriage return', () => {
    const scan: Scan = scanSkillFences([MARKER, '```json', '{"a":1}', '```'].join('\r\n'));
    expect(scan.fences).toHaveLength(1);
    expect(scan.fences[0].marked).toBe(true);
    expect(scan.fences[0].body).toBe('{"a":1}');
  });
});

describe('languages', () => {
  it('recognises the three TypeScript spellings and the two JSON ones', () => {
    expect([...TS_FENCE_LANGUAGES].sort()).toEqual(['ts', 'tsx', 'typescript']);
    expect([...JSON_FENCE_LANGUAGES].sort()).toEqual(['json', 'jsonc']);
  });

  it('classifies each candidate by kind', () => {
    const scan: Scan = scanSkillFences(
      ['```tsx', 'const a = <div />;', '```', '', '```jsonc', '{}', '```'].join('\n'),
    );
    expect(scan.fences.map((f) => [f.language, f.kind])).toEqual([
      ['tsx', 'ts'],
      ['jsonc', 'json'],
    ]);
  });

  it('ignores a language it cannot judge', () => {
    const scan: Scan = scanSkillFences(['```css', '.a { color: red }', '```'].join('\n'));
    expect(scan.fences).toEqual([]);
  });
});

describe('JSON fences — `json` is strict, `jsonc` is exactly two things looser', () => {
  it('accepts valid JSON', () => {
    expect(parseJsonFence('{"a": 1}', 'json')).toBeNull();
  });

  it('rejects a trailing comma under `json`', () => {
    // A `json` fence is a claim about what a real `.json` file may contain, so a
    // tolerant parser here would bless a file no `JSON.parse` in the product
    // would accept.
    expect(parseJsonFence('{"a": 1,}', 'json')).not.toBeNull();
  });

  it('rejects a comment under `json`', () => {
    expect(parseJsonFence('{\n  // nope\n  "a": 1\n}', 'json')).not.toBeNull();
  });

  it('accepts both under `jsonc`', () => {
    expect(parseJsonFence('{"a": 1,}', 'jsonc')).toBeNull();
    expect(parseJsonFence('{\n  /* fine */\n  "a": 1\n}', 'jsonc')).toBeNull();
  });

  it('does not mistake a `//` inside a string for a comment', () => {
    // Written as a scanner rather than a regex for exactly this: a URL in a
    // guide example is not hypothetical.
    expect(stripJsonComments('{"url": "https://example.com/x"}')).toBe('{"url": "https://example.com/x"}');
    expect(parseJsonFence('{"url": "https://example.com/x"}', 'jsonc')).toBeNull();
  });

  it('does not mistake an escaped quote for the end of a string', () => {
    expect(stripJsonComments('{"a": "he said \\"//\\" here"}')).toBe('{"a": "he said \\"//\\" here"}');
  });

  it('keeps line count stable when it blanks a block comment', () => {
    // Diagnostics quote line numbers; a stripper that collapsed lines would
    // point at the wrong one.
    const source = '{\n/* one\n   two */\n"a": 1\n}';
    expect(stripJsonComments(source).split('\n')).toHaveLength(source.split('\n').length);
  });

  it('reports a truncated object rather than accepting it', () => {
    expect(parseJsonFence('{"a": 1', 'json')).not.toBeNull();
  });
});

describe('the scan surface is a decision, stated here rather than read off the walker', () => {
  it('walks the published bundle AND `.claude/skills`, and nothing else', () => {
    // objectui#7463 item 3 widened this to `.claude/skills`, the same widening
    // `check-skills-paths.mjs` took in objectui#7358 and for the same reason:
    // when objectui#7251 moved the contributor-only guides out of `skills/`,
    // a gate rooted only at `skills` silently stopped looking at them. It
    // stays a stated decision with a measurement, never a silent drift — the
    // widening added 9 candidate fences and ZERO marked ones.
    expect(SCAN_ROOTS).toEqual(['skills', '.claude/skills']);
  });

  it('collects every `.md` under the roots, recursively and in a stable order', () => {
    withTree(
      (write) => {
        write('skills/objectui/guides/b.md', '# b\n');
        write('skills/objectui/guides/a.md', '# a\n');
        write('skills/objectui/SKILL.md', '# skill\n');
        write('skills/objectui/notes.txt', 'not markdown\n');
        write('content/docs/elsewhere.md', '# not in scope\n');
      },
      (dir) => {
        expect(listGuides(dir)).toEqual([
          'skills/objectui/SKILL.md',
          'skills/objectui/guides/a.md',
          'skills/objectui/guides/b.md',
        ]);
      },
    );
  });

  it('returns an empty list rather than throwing when a root is absent', () => {
    withTree(
      (write) => write('README.md', '# nothing here\n'),
      (dir) => expect(listGuides(dir)).toEqual([]),
    );
  });

  it('really does read the published bundle in this checkout', () => {
    // Non-vacuity: every assertion above is about fixtures, and a gate pointed
    // at a root that does not exist would satisfy all of them while judging
    // nothing at all.
    const guides = listGuides(repoRoot) as string[];
    expect(guides.length).toBeGreaterThan(5);
    expect(guides.every((g) => SCAN_ROOTS.some((r) => g.startsWith(`${r}/`)))).toBe(true);
    // Both roots must actually be non-empty in this checkout, or the widening
    // would be a root list nothing reads — the vacuity this leg exists to deny.
    expect(guides.some((g) => g.startsWith('skills/'))).toBe(true);
    expect(guides.some((g) => g.startsWith('.claude/skills/'))).toBe(true);
  });
});

describe('the corpus this gate governs', () => {
  const guides = listGuides(repoRoot) as string[];
  const scans = guides.map((g) => ({
    guide: g,
    scan: scanSkillFences(fs.readFileSync(path.join(repoRoot, g), 'utf8')) as Scan,
  }));

  it('carries no orphan marker', () => {
    // The same verdict the gate reaches, asserted here too because this half
    // needs no build — so a stale marker is caught by the cheap job as well as
    // by the one that installs and builds.
    const orphans = scans.flatMap(({ guide, scan }) => scan.orphans.map((line) => `${guide}:${line}`));
    expect(
      orphans,
      `\`${MARKER}\` must be the line IMMEDIATELY above a ts/tsx/typescript/json/jsonc fence. ` +
        `At these sites it opts nothing in, so the example below reads as gated and is not:\n` +
        orphans.map((o) => `  - ${o}`).join('\n'),
    ).toEqual([]);
  });

  it('has a non-empty marked population — a gate that checks nothing must not report success', () => {
    const marked = scans.flatMap(({ scan }) => scan.fences.filter((f) => f.marked));
    expect(marked.length).toBeGreaterThan(0);
    // Both languages are really exercised. Without this the population could
    // collapse to one kind and the other half of the gate would be dead code
    // nobody noticed.
    expect(marked.some((f) => f.kind === 'ts')).toBe(true);
    expect(marked.some((f) => f.kind === 'json')).toBe(true);
  });

  it('leaves the majority unmarked — opt-in is the design, not a migration halfway done', () => {
    // Stated as a RATIO rather than a count on purpose. objectui#7359 explicitly
    // did NOT decide whether the marked population becomes shrink-only, and a
    // count pinned here would be that decision taken by accident, red on the
    // next guide anyone edits.
    const all = scans.flatMap(({ scan }) => scan.fences);
    const marked = all.filter((f) => f.marked);
    expect(marked.length).toBeLessThan(all.length);
  });

  it('spells every marker byte-identically', () => {
    // A near-spelling (`<!--os:check-->`, a smart dash, a stray space inside)
    // reads as a marker and claims nothing. It would surface as an orphan only
    // if it matched the orphan scan's own literal — which it does not.
    for (const guide of guides) {
      const source = fs.readFileSync(path.join(repoRoot, guide), 'utf8');
      for (const [index, line] of source.split('\n').entries()) {
        if (!/os:check/.test(line)) continue;
        expect(line, `${guide}:${index + 1} carries a near-spelling of the marker`).toBe(MARKER);
      }
    }
  });
});

describe('exit codes — "could not run" is not "ran and found errors"', () => {
  it('names all three, and keeps them distinct', () => {
    expect(EXIT_CODES.verified).toBe(0);
    expect(EXIT_CODES.examplesFailed).toBe(1);
    expect(EXIT_CODES.couldNotRun).toBe(2);
  });
});

describe('the build filter carries the dependency closure', () => {
  it('emits sorted `--filter=<pkg>...` words', () => {
    expect(buildFilterArgs(['@object-ui/react', '@object-ui/core'])).toBe(
      '--filter=@object-ui/core... --filter=@object-ui/react...',
    );
  });

  it('emits nothing for an empty set, which the workflow refuses rather than expands', () => {
    // A bare `turbo run build` over the whole workspace is the one thing the
    // workflow's header forbids, so the empty case must be visibly empty here.
    expect(buildFilterArgs([])).toBe('');
  });
});

describe('wiring — the gate is reachable and a markdown-only PR starts it', () => {
  const SCRIPT = 'scripts/check-skill-examples.mjs';
  const workflowDir = path.join(repoRoot, '.github/workflows');
  const workflowPath = path.join(workflowDir, 'skill-examples.yml');
  const workflowFiles = fs.readdirSync(workflowDir).filter((f) => f.endsWith('.yml'));

  /**
   * A workflow's YAML with whole-line comments removed. Every workflow in this
   * repository discusses `paths`, `paths-ignore` and its neighbours' scripts in
   * prose; a scan that counted comments would report filters and duplicate homes
   * that no file has.
   */
  const yamlOf = (file: string) =>
    fs
      .readFileSync(path.join(workflowDir, file), 'utf8')
      .split('\n')
      .filter((line) => !/^\s*#/.test(line))
      .join('\n');

  it('is exposed as a root package script', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    expect(pkg.scripts['check:skill-examples']).toBe(`node ${SCRIPT}`);
  });

  it('has a workflow that gates pull requests, not just pushes', () => {
    expect(fs.existsSync(workflowPath), 'a check nothing runs is not a gate').toBe(true);
    const yaml = yamlOf('skill-examples.yml');
    expect(yaml).toMatch(new RegExp(`run:\\s*node\\s+${SCRIPT.replace(/[.]/g, '\\.')}\\s*$`, 'm'));
    expect(yaml).toMatch(/^\s*pull_request:/m);
    expect(yaml).toMatch(/^\s*push:/m);
    expect(yaml).toMatch(/^\s*merge_group:/m);
  });

  it('runs the self-test too — a probe nobody runs is a probe that passes', () => {
    expect(yamlOf('skill-examples.yml')).toMatch(
      new RegExp(`run:\\s*node\\s+${SCRIPT.replace(/[.]/g, '\\.')}\\s+--self-test`),
    );
  });

  it('derives its build filter from the gate rather than hand-maintaining one', () => {
    const yaml = yamlOf('skill-examples.yml');
    expect(yaml).toContain('--build-filter');
    // ⛔ The one thing the header forbids: an unfiltered workspace build.
    expect(yaml).not.toMatch(/turbo run build\s*$/m);
    expect(yaml).not.toMatch(/pnpm build/);
  });

  it('runs it in NO path-filtered workflow — the scan surface is entirely markdown', () => {
    // The whole reason this is its own workflow. `ci.yml` and `lint.yml` list
    // `'**/*.md'` under the `paths-ignore` of their `push` trigger and GitHub
    // has no per-job path filter, so a push that only edits a guide would never
    // start them. That is exactly the hole #3448 (docs links), control-bytes.yml
    // and skills-paths.yml were split out to close.
    expect(workflowFiles.length, 'the workflow directory scan returned implausibly few files').toBeGreaterThan(5);
    for (const file of workflowFiles) {
      const yaml = yamlOf(file);
      if (!yaml.includes(SCRIPT)) continue;
      expect(yaml, `${file} runs ${SCRIPT} behind a paths-ignore — a guide-only change would not start it`).not.toMatch(
        /paths-ignore:/,
      );
      expect(yaml, `${file} runs ${SCRIPT} behind a paths filter — see objectui#3448`).not.toMatch(/^\s+paths:/m);
    }
  });

  it('has exactly one home', () => {
    // A second copy in a path-filtered workflow is how a gate ends up looking
    // covered while the change it exists for still slips past.
    expect(workflowFiles.filter((f) => yamlOf(f).includes(SCRIPT))).toEqual(['skill-examples.yml']);
  });

  it('does not run a NEIGHBOUR gate from this workflow', () => {
    // `check-doc-snippet-types.test.ts` pins that its own script lives in
    // exactly one workflow. This gate imports that script's harness as a MODULE,
    // which is the intended reuse; invoking it from this YAML would break that
    // pin and give one gate two homes.
    expect(yamlOf('skill-examples.yml')).not.toContain('scripts/check-doc-snippet-types.mjs');
  });

  it('is classified as a blocking context rather than defaulting into silence', () => {
    // `dependabot-merge-gate.test.ts` asserts its three buckets partition the
    // produced check-run set exactly, and `merge-queue-reporting.test.ts`
    // derives the `merge_group` floor from the required bucket. Asserted here
    // too, in this gate's own file, so the reason travels with the gate.
    const gate = fs.readFileSync(path.join(repoRoot, 'scripts/dependabot-merge-gate.mjs'), 'utf8');
    expect(gate).toContain("'Skill Example Check'");
  });

  it('has a section on the CI page, named by heading', () => {
    // `ci-cd-pipeline-doc.test.ts` enforces this repo-wide; restated here
    // because objectui#3212's lesson is that the omission happens at the moment
    // the workflow is added, not later.
    const doc = fs.readFileSync(path.join(repoRoot, 'content/docs/guide/ci-cd-pipeline.md'), 'utf8');
    const headings = doc.split('\n').filter((line) => /^#{1,6}\s/.test(line));
    expect(headings.some((h) => h.includes('skill-examples.yml'))).toBe(true);
  });
});

describe('the harness is imported, not re-rolled', () => {
  /**
   * `check-doc-snippet-types.mjs` had its type-check harness hand-rolled three
   * separate times before it was consolidated, and its header records that one
   * of those three produced a FALSE GREEN. The harness carries the
   * syntax/semantics split and the four self-controls; a second copy here would
   * be a second answer to the same question, free to drift.
   *
   * Pinned as a source-level fact because it is invisible in behaviour: a forked
   * harness would pass every other assertion in this file.
   */
  it('imports the compiler and resolution helpers from the docs gate', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'scripts/check-skill-examples.mjs'), 'utf8');
    const importBlock = source.match(/import\s*\{[^}]*\}\s*from\s*'\.\/check-doc-snippet-types\.mjs';/);
    expect(importBlock, 'the shared harness import is gone — has it been forked?').not.toBeNull();
    for (const name of ['compileSnippets', 'derivePackageTypePaths', 'deriveDeclaredDependencyPaths']) {
      expect(importBlock![0]).toContain(name);
    }
  });

  it('does not build a TypeScript Program of its own', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'scripts/check-skill-examples.mjs'), 'utf8');
    expect(source).not.toContain('ts.createProgram');
    expect(source).not.toContain('ts.createCompilerHost');
  });
});

/**
 * objectui#7463 item 1 — the bare-`any` assertion, ported from objectstack's
 * `packages/spec/scripts/check-skill-examples.ts`.
 *
 * The NEGATIVE half carries the weight. A bare `any` erases checking wholesale,
 * but an `any` nested in a larger type is a much broader question with a much
 * larger baseline, and a guard that flagged it would red on prose that is not
 * wrong — which is how gates get deleted. That boundary is the whole design, so
 * it is pinned rather than left to the implementation.
 */
describe('the bare-`any` assertion', () => {
  it.each([
    ['a parameter', 'export function f(ctx: any) { return ctx; }', 'parameter `ctx`'],
    ['a variable', 'export const x: any = 1;', 'variable `x`'],
    ['an interface property', 'export interface I { p: any }', 'property `p`'],
    ['a class property', 'export class C { p: any = 1; }', 'property `p`'],
    ['a type alias', 'export type A = any;', 'type alias `A`'],
    ['a return type', 'export function g(): any { return 1; }', 'return type'],
    ['an arrow return type', 'export const h = (): any => 1;', 'return type'],
    ['a method signature return', 'export interface J { m(): any }', 'return type'],
    ['an `as any` cast', 'export const y = ({} as any);', '`as any` assertion'],
    ['a `satisfies any`', 'export const z = ({} satisfies any);', '`satisfies any` assertion'],
  ])('flags %s', (_label, code, want) => {
    const hits = findBareAny(code) as { where: string }[];
    expect(hits.map((h) => h.where)).toEqual([want]);
  });

  it.each([
    ['Record<string, any>', 'export const a: Record<string, any> = {};'],
    ['any[]', 'export const b: any[] = [];'],
    ['Array<any>', 'export const c: Array<any> = [];'],
    ['Promise<any>', 'export async function d(): Promise<any> { return 1; }'],
    ['a union arm', 'export const e: string | any[] = [];'],
    ['the word "any" in a string or a comment', 'export const f = "any"; // any of them'],
  ])('does NOT flag a nested `any` in %s', (_label, code) => {
    expect(findBareAny(code)).toEqual([]);
  });

  it('parses as TSX, so a JSX example is not mis-read as a type assertion', () => {
    // `compileSnippets` parses every block as TSX regardless of the fence
    // label. A guard walking a different tree would be reporting about a
    // program `tsc` never judged.
    expect(findBareAny('export const El = () => <div className="x">hi</div>;')).toEqual([]);
  });

  it('yields nothing rather than throwing on a block too broken to parse', () => {
    // The `tsc` syntax leg owns that verdict; this guard must not double-report
    // it, and must not crash the run either.
    expect(() => findBareAny('export const three: = ;')).not.toThrow();
  });

  it('builds a baseline row key naming the guide, the fence line and the position', () => {
    const block = { doc: 'skills/objectui/guides/x.md', fenceLine: 42 };
    const finding = (findBareAny('export function f(ctx: any) {}') as { where: string }[])[0];
    expect(bareAnyRowKey(block, finding)).toBe('skills/objectui/guides/x.md:42 parameter `ctx`');
  });

  it('declares its baseline as a shrink-only Set of verbatim rows', () => {
    // Every row must be shaped like a key this gate can actually produce, or it
    // would sit in the list forever covering nothing — a parked exemption
    // wearing a ratchet's clothes.
    expect(KNOWN_BARE_ANY_EXAMPLES).toBeInstanceOf(Set);
    for (const row of KNOWN_BARE_ANY_EXAMPLES as Set<string>) {
      expect(row, `baseline row is not \`GUIDE:LINE POSITION\`: ${row}`).toMatch(
        /^[\w./-]+\.md:\d+ .+$/,
      );
      expect(SCAN_ROOTS.some((r: string) => row.startsWith(`${r}/`))).toBe(true);
    }
  });
});
