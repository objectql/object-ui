import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Plain-JS CI helper. Its types are INFERRED from the .mjs source by
// `tsconfig.scripts.json` (`allowJs`), so no `@ts-expect-error` here —
// re-adding one is now itself an error (TS2578). See objectui#3494.
import {
  BASELINE,
  MAX_EAGER_CLOSURE_GZIP_BYTES,
  PER_CHUNK_BASELINE,
  PER_CHUNK_GZIP_CEILINGS,
  REGRESSION_THIS_GATE_MUST_CATCH_BYTES,
  SUPPORTED_REPORT_VERSION,
  VERDICT_CEILING_CONSTANTS,
  evaluateCeilingFreshness,
  evaluateClosureBudget,
  evaluateHeadroomSensitivity,
  evaluatePerChunkBudgets,
  extractCeilingDeclarations,
  main,
  measureChunksByName,
  renderTopChunks,
  validateReport,
} from '../check-eager-closure-budget.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflowPath = path.join(repoRoot, '.github/workflows/performance-budget.yml');
const viteConfigPath = path.join(repoRoot, 'apps/console/vite.config.ts');
const checkerPath = path.join(repoRoot, 'scripts/check-eager-closure-budget.mjs');

/**
 * A report shaped exactly like `emitEagerClosureReport`'s output, with the
 * chunk list summing to the declared total — the checker refuses reports where
 * it does not.
 */
function report(overrides: Record<string, unknown> = {}) {
  const files = [
    { fileName: 'assets/index-A.js', name: 'index', bytes: 90_000, gzipBytes: 25_910 },
    {
      fileName: 'assets/vendor-objectstack-B.js',
      name: 'vendor-objectstack',
      bytes: 5_000_000,
      gzipBytes: 1_529_129,
    },
    { fileName: 'assets/framework-C.js', name: 'framework', bytes: 1_800_000, gzipBytes: 495_690 },
  ];
  return {
    reportVersion: SUPPORTED_REPORT_VERSION,
    entryChunks: ['assets/index-A.js'],
    eagerChunkCount: files.length,
    totalChunkCount: 507,
    eagerGzipBytes: files.reduce((n, f) => n + f.gzipBytes, 0),
    eagerRawBytes: files.reduce((n, f) => n + f.bytes, 0),
    files,
    ...overrides,
  };
}

/**
 * objectui#5324: the console "performance budget" gzipped one file — the
 * `index-*.js` entry chunk — against a 350 KB line. On `77f846a8b` that chunk
 * is 25.9 KB while the closure it statically pulls in is 3,881,609 bytes across
 * 58 of 507 chunks, so the gate passed on 0.67% of the payload it claimed to
 * govern; the 89 KiB regression of objectui#5266 landed in a vendor chunk and
 * was structurally invisible to it.
 */
describe('the ceiling itself', () => {
  /**
   * Both constraints on the chosen number, as assertions rather than prose.
   * A ceiling below today's payload lands red and gets disabled; a ceiling more
   * than one known regression above it is decorative.
   */
  /** A closure report totalling exactly `gzipBytes`, spread over `chunks` files. */
  function closureOf(gzipBytes: number, chunks = BASELINE.chunks) {
    const files = Array.from({ length: chunks }, (_, i) => ({
      fileName: `assets/chunk-${i}.js`,
      name: `chunk-${i}`,
      bytes: 0,
      gzipBytes: i === 0 ? gzipBytes - (chunks - 1) : 1,
    }));
    return report({
      files,
      eagerChunkCount: chunks,
      totalChunkCount: BASELINE.totalChunks,
      eagerGzipBytes: gzipBytes,
    });
  }

  it('passes on the measured baseline, with headroom', () => {
    expect(MAX_EAGER_CLOSURE_GZIP_BYTES).toBeGreaterThan(BASELINE.gzipBytes);
    expect(evaluateClosureBudget({ report: closureOf(BASELINE.gzipBytes) }).status).toBe('pass');
  });

  /**
   * ⚠️ This pair of assertions is the SECONDARY guard, and objectui#5924 is the
   * record of what it cannot do. Both operands are literals frozen in the
   * checker, so it is true regardless of what the console weighs: it stayed
   * green while the closure fell ~706 KB below the pinned baseline and the live
   * headroom reached 8.6x the regression size. It is kept because it still
   * catches the one thing it can — an edit that raises a ceiling past the
   * regression size, with no build in sight — and it is no longer the only
   * check of this invariant. The live one is `evaluateHeadroomSensitivity`,
   * exercised further down.
   */
  it('would have failed on the regression it exists to catch', () => {
    const headroom = MAX_EAGER_CLOSURE_GZIP_BYTES - BASELINE.gzipBytes;
    expect(headroom).toBeLessThan(REGRESSION_THIS_GATE_MUST_CATCH_BYTES);

    const afterRegression = BASELINE.gzipBytes + REGRESSION_THIS_GATE_MUST_CATCH_BYTES;
    expect(evaluateClosureBudget({ report: closureOf(afterRegression) }).status).toBe('fail');
  });
});

describe('evaluateClosureBudget', () => {
  it('passes a closure inside the budget and names the headroom', () => {
    const result = evaluateClosureBudget({ report: report(), budgetBytes: 3_000_000 });
    expect(result.status).toBe('pass');
    expect(result.gzipBytes).toBe(2_050_729);
    expect(result.chunkCount).toBe(3);
    expect(result.message).toContain('headroom');
  });

  it('fails a closure over the budget and says how far over', () => {
    const result = evaluateClosureBudget({ report: report(), budgetBytes: 2_000_000 });
    expect(result.status).toBe('fail');
    expect(result.message).toContain('over the');
    // A failure must not read as an invitation to widen the number.
    expect(result.message).toContain('do not widen it just to get a green check');
  });

  /**
   * The whole family of "the gauge broke" cases, which all share one shape: the
   * number comes out SMALL, and a budget check reads small as good news. Every
   * one of them must be an error, never a pass.
   */
  describe('refuses a verdict rather than reporting a number it cannot trust', () => {
    it('when the report is absent', () => {
      const result = evaluateClosureBudget({ report: null });
      expect(result.status).toBe('error');
      expect(result.message).toContain('not a passing budget');
      expect(result.gzipBytes).toBeNull();
    });

    it('when the emitter and the checker have drifted apart', () => {
      const result = evaluateClosureBudget({ report: report({ reportVersion: 99 }) });
      expect(result.status).toBe('error');
      expect(result.message).toContain('reportVersion');
    });

    it('when the closure collapsed to its entry chunk — the gauge this replaces', () => {
      const files = [
        { fileName: 'assets/index-A.js', name: 'index', bytes: 90_000, gzipBytes: 25_910 },
      ];
      const result = evaluateClosureBudget({
        report: report({ files, eagerChunkCount: 1, eagerGzipBytes: 25_910 }),
      });
      expect(result.status).toBe('error');
      expect(result.message).toContain('collapsed to its entry chunk');
    });

    it('when every chunk is eager, so nothing separates static from dynamic', () => {
      const result = evaluateClosureBudget({ report: report({ totalChunkCount: 3 }) });
      expect(result.status).toBe('error');
      expect(result.message).toContain('not separating static from dynamic');
    });

    it('when the totals disagree with the chunk list', () => {
      const result = evaluateClosureBudget({ report: report({ eagerGzipBytes: 1 }) });
      expect(result.status).toBe('error');
      expect(result.message).toContain('internally inconsistent');
    });

    it('when the walk had no roots', () => {
      const result = evaluateClosureBudget({ report: report({ entryChunks: [] }) });
      expect(result.status).toBe('error');
      expect(result.message).toContain('no roots');
    });

    it.each([['eagerGzipBytes'], ['eagerChunkCount'], ['totalChunkCount']])(
      'when %s is missing (an absent field must never read as zero)',
      (key) => {
        expect(validateReport(report({ [key]: undefined })).join(' ')).toContain(key);
      },
    );

    it('when the report is not an object at all', () => {
      expect(validateReport('3881609')).toEqual(['report is not an object']);
    });
  });
});

/**
 * objectui#5490 — per-chunk ceilings on top of the aggregate.
 *
 * The aggregate is one number over 52 chunks: inside its headroom a single
 * chunk can absorb the whole allowance while the others shrink, and the total
 * never moves. objectui#5266 is that shape exactly — 89 KiB, all of it in
 * `vendor-objectstack`. These tests hold the two properties that decide whether
 * the per-chunk half is worth anything: it must be red when a budgeted chunk
 * grows, and it must be red — not silent — when a budgeted chunk is not there
 * to weigh.
 */
describe('per-chunk ceilings', () => {
  /** A v2 report carrying the real budgeted names at the real measured sizes. */
  function budgetedReport(sizes: Record<string, number> = {}) {
    const measured: Record<string, number> = { ...PER_CHUNK_BASELINE, ...sizes };
    const files = [
      { fileName: 'assets/index-A.js', name: 'index', bytes: 0, gzipBytes: 25_910 },
      ...Object.entries(measured).map(([name, gzipBytes]) => ({
        fileName: `assets/${name}-hash.js`,
        name,
        bytes: 0,
        gzipBytes,
      })),
    ];
    return report({
      files,
      eagerChunkCount: files.length,
      eagerGzipBytes: files.reduce((n, f) => n + f.gzipBytes, 0),
      eagerRawBytes: 0,
    });
  }

  describe('the ceilings themselves', () => {
    it('budgets exactly the chunks it has measured', () => {
      // A ceiling with no measurement behind it is a guess; a measurement with
      // no ceiling weighs nothing. Neither may exist alone.
      expect(Object.keys(PER_CHUNK_GZIP_CEILINGS).sort()).toEqual(
        Object.keys(PER_CHUNK_BASELINE).sort(),
      );
      expect(Object.keys(PER_CHUNK_GZIP_CEILINGS).length).toBeGreaterThan(0);
    });

    it.each(Object.keys(PER_CHUNK_GZIP_CEILINGS))(
      '%s passes on its measured size, with headroom narrower than the regression it must catch',
      (name) => {
        const measured = PER_CHUNK_BASELINE[name as keyof typeof PER_CHUNK_BASELINE];
        const ceiling = PER_CHUNK_GZIP_CEILINGS[name as keyof typeof PER_CHUNK_GZIP_CEILINGS];
        // Truthful current state: a ceiling under today's payload lands red on
        // `main`, which is how a budget gets switched off rather than met.
        expect(ceiling).toBeGreaterThan(measured);
        // ...and headroom wider than one known regression makes the line
        // decorative — objectui#5266's 89 KiB landed in one of these chunks.
        expect(ceiling - measured).toBeLessThan(REGRESSION_THIS_GATE_MUST_CATCH_BYTES);
      },
    );

    it('passes on the measured baseline and names every size and headroom', () => {
      const result = evaluatePerChunkBudgets({ report: budgetedReport() });
      expect(result.status).toBe('pass');
      // The verdict carries the MEASUREMENT, not a tick: a reader watching a
      // chunk creep upward should see it coming.
      for (const [name, measured] of Object.entries(PER_CHUNK_BASELINE)) {
        expect(result.message).toContain(name);
        expect(result.message).toContain((measured / 1024).toFixed(1));
      }
      expect(result.message).toContain('headroom');
    });

    it('would have caught objectui#5266 — 89 KiB into a single budgeted chunk', () => {
      const result = evaluatePerChunkBudgets({
        report: budgetedReport({
          'vendor-objectstack':
            PER_CHUNK_BASELINE['vendor-objectstack'] + REGRESSION_THIS_GATE_MUST_CATCH_BYTES,
        }),
      });
      expect(result.status).toBe('fail');
      expect(result.over).toEqual(['vendor-objectstack']);
    });
  });

  it('fails a chunk over its ceiling, naming the chunk and BOTH numbers', () => {
    const over = PER_CHUNK_GZIP_CEILINGS.framework + 1;
    const result = evaluatePerChunkBudgets({ report: budgetedReport({ framework: over }) });
    expect(result.status).toBe('fail');
    expect(result.over).toEqual(['framework']);
    expect(result.message).toContain('framework');
    expect(result.message).toContain((over / 1024).toFixed(1));
    expect(result.message).toContain((PER_CHUNK_GZIP_CEILINGS.framework / 1024).toFixed(1));
    expect(result.message).toContain('do not widen it just to get a green check');
  });

  it('sums chunks sharing a name, so a group cannot split its way under a ceiling', () => {
    const half = Math.ceil((PER_CHUNK_GZIP_CEILINGS['ui-components'] + 2) / 2);
    const base = budgetedReport();
    const files = [
      ...base.files.filter((f) => f.name !== 'ui-components'),
      { fileName: 'assets/ui-components-1.js', name: 'ui-components', bytes: 0, gzipBytes: half },
      { fileName: 'assets/ui-components-2.js', name: 'ui-components', bytes: 0, gzipBytes: half },
    ];
    const result = evaluatePerChunkBudgets({
      report: report({
        files,
        eagerChunkCount: files.length,
        eagerGzipBytes: files.reduce((n, f) => n + f.gzipBytes, 0),
        eagerRawBytes: 0,
      }),
    });
    expect(measureChunksByName({ files }).get('ui-components')?.gzipBytes).toBe(half * 2);
    expect(result.status).toBe('fail');
    expect(result.over).toEqual(['ui-components']);
  });

  /**
   * The clause the whole card turns on: a budget keyed on a chunk that no
   * longer exists is VACUOUSLY GREEN — it passes because it is measuring
   * nothing. Every case here must be an ERROR, never a skip and never a pass.
   */
  describe('refuses to weigh a chunk that is not there', () => {
    it('errors when a budgeted chunk has been renamed, naming it and listing what IS present', () => {
      const base = budgetedReport();
      const files = base.files.map((f) =>
        f.name === 'vendor-objectstack' ? { ...f, name: 'vendor-objectstack-core' } : f,
      );
      const result = evaluatePerChunkBudgets({ report: report({ ...base, files }) });
      expect(result.status).toBe('error');
      expect(result.missing).toEqual(['vendor-objectstack']);
      expect(result.message).toContain('vendor-objectstack');
      expect(result.message).toContain('ABSENT');
      // The new spelling is in the message, so a rename is diagnosable from the
      // failure alone rather than from a second build.
      expect(result.message).toContain('vendor-objectstack-core');
    });

    it('errors when a budgeted chunk has left the closure entirely', () => {
      const base = budgetedReport();
      const files = base.files.filter((f) => f.name !== 'framework');
      const result = evaluatePerChunkBudgets({
        report: report({
          files,
          eagerChunkCount: files.length,
          eagerGzipBytes: files.reduce((n, f) => n + f.gzipBytes, 0),
          eagerRawBytes: 0,
        }),
      });
      expect(result.status).toBe('error');
      expect(result.missing).toEqual(['framework']);
      // Good news is still RE-PINNED deliberately, not inferred by a gate.
      expect(result.message).toContain('RE-PINNED');
    });

    it('errors on a report with no chunks at all — a collapse is not an under-budget bundle', () => {
      const result = evaluatePerChunkBudgets({
        report: report({ files: [], eagerChunkCount: 0, eagerGzipBytes: 0 }),
      });
      expect(result.status).toBe('error');
      expect(measureChunksByName({ files: [] }).size).toBe(0);
    });

    it('errors when no ceilings are configured — an empty budget is a disabled one', () => {
      const result = evaluatePerChunkBudgets({ report: budgetedReport(), ceilings: {} });
      expect(result.status).toBe('error');
      expect(result.message).toContain('weighs nothing');
    });

    it('errors when the report carries no chunk names (a build from before v2)', () => {
      const base = budgetedReport();
      const files = base.files.map(({ name: _name, ...rest }) => rest);
      expect(validateReport(report({ ...base, files })).join(' ')).toContain('no chunk `name`');
      const result = evaluatePerChunkBudgets({ report: report({ ...base, files }) });
      expect(result.status).toBe('error');
    });

    it('errors when there is no report at all — an unbuilt tree measures nothing', () => {
      const result = evaluatePerChunkBudgets({ report: null });
      expect(result.status).toBe('error');
      expect(result.message).toContain('broken gauge');
    });
  });
});

/**
 * objectui#5924 — the headroom invariant, checked against the report the gate
 * just read instead of against two literals frozen beside it.
 *
 * The invariant itself is old and stated in the checker's header: the headroom
 * above the measurement must stay SMALLER than the regression the gate exists
 * to catch, or a repeat of that regression fits inside it and passes. What was
 * new in objectui#5924 is where it was checked. `MAX_EAGER_CLOSURE_GZIP_BYTES -
 * BASELINE.gzipBytes < REGRESSION_...` is an arithmetic fact about the module,
 * true forever once written, and it stayed true while the console shrank ~706
 * KB underneath it — leaving a demonstrated +158,006-byte eager regression
 * green, 1.7x the incident the gate was built for.
 *
 * These tests are about the four ceilings this file now ships (the aggregate
 * plus the three per-chunk lines objectui#5490 added), each weighed against its
 * own measurement in the report.
 */
/**
 * The composition pin (objectui#7399).
 *
 * These ceilings are keyed on chunk NAMES, and until this card nothing checked
 * that a name still described its contents. It did not: `framework`'s group
 * test is `packages/(core|react|types)`, and the emitted `framework` chunk held
 * all ten `packages/i18n` locale catalogues — 78.7% of its bytes — because five
 * workspace groups shared `priority: 80` and `framework` was written first. So
 * `PER_CHUNK_GZIP_CEILINGS['framework']` was in operation a budget on the
 * translation catalogue, with 41 bytes of headroom, and its failure message
 * named the wrong cause.
 *
 * ⚠️ This is deliberately a check on the DECIDING INPUT, not on prose. The
 * config's own comment said `core|react|types` throughout the defect and was
 * true about the regex the whole time; what was false was the assumption that a
 * group only takes what its regex matches. The predicate below is the one that
 * was actually violated — a TIE between a group whose test matches the
 * catalogue and one whose test does not.
 *
 * The byte-level backstop is the re-baselined ceiling itself: `framework` is
 * now pinned at 71,000 over a 61,465 payload, so a regression that puts the
 * 446 KB catalogue back would red the gate six times over. That verdict is
 * loud but mute about the cause. This one names it.
 *
 * ⛔ Every case here fails CLOSED. The parse yielding nothing, or a probe id
 * matching no group at all, is an ERROR and not a pass — a matcher that matches
 * nothing agrees with a correctly-attributed bundle on every assertion below.
 */
describe('chunk attribution (objectui#7399)', () => {
  /** A group as `advancedChunks.groups` declares it. */
  type Group = { name: string; priority: number; test: RegExp | null };

  /**
   * Parse the groups out of the console's vite config.
   *
   * `test` is `null` for a group whose test is an IDENTIFIER rather than a
   * regex literal (`vendor-objectstack` reads a computed test, so that the
   * `OBJECTSTACK_SPEC_DIST` override cannot change the chunk layout —
   * objectui#5388). Those are refused a verdict below rather than guessed at.
   */
  function parseGroups(): Group[] {
    const source = fs.readFileSync(viteConfigPath, 'utf8');
    const entry =
      /\{\s*name:\s*'([^']+)',\s*test:\s*(\/(?:[^/\\\n]|\\.|\[[^\]\n]*\])+\/[a-z]*|[A-Za-z_$][\w$]*)\s*,\s*priority:\s*(\d+)\s*\}/g;
    return [...source.matchAll(entry)].map(([, name, test, priority]) => {
      const literal = /^\/(.*)\/([a-z]*)$/s.exec(test);
      return {
        name,
        priority: Number(priority),
        test: literal ? new RegExp(literal[1], literal[2]) : null,
      };
    });
  }

  const groups = parseGroups();

  /** Rolldown matches group tests against REALPATHS, measured on objectui#7399. */
  const moduleId = (relative: string) => path.join(repoRoot, relative);

  const LOCALE_MODULE = moduleId('packages/i18n/src/locales/zh-CN.ts');
  const DATA_MODULE = moduleId('packages/data-objectstack/src/index.ts');
  const CORE_MODULE = moduleId('packages/core/src/index.ts');

  /** The groups whose test matches this id, highest priority first. */
  function claimants(id: string): Group[] {
    return groups
      .filter((g) => g.test?.test(id))
      .sort((a, b) => b.priority - a.priority);
  }

  describe('the parse itself — a matcher that matches nothing agrees with everything', () => {
    it('finds the whole group table, not a fragment of it', () => {
      // ~35 groups are declared. A reformat that breaks this parse must red
      // here rather than quietly reduce every case below to a tautology.
      expect(groups.length).toBeGreaterThan(20);
      expect(groups.map((g) => g.name)).toEqual(expect.arrayContaining([
        'framework',
        'i18n-locales',
        'data-adapter',
        'ui-components',
        'infrastructure',
      ]));
    });

    it('reads a control module to the group that owns it', () => {
      expect(claimants(CORE_MODULE)[0]?.name).toBe('framework');
    });

    it('refuses a verdict on a group whose test it could not read', () => {
      // Exactly one group takes a computed test today. A second one appearing
      // reds this case, because such a group could claim the probe ids below
      // without this parse ever seeing it.
      expect(groups.filter((g) => g.test === null).map((g) => g.name)).toEqual([
        'vendor-objectstack',
      ]);
    });
  });

  describe('the defect this pin exists to stop', () => {
    it('`framework`s test matches NEITHER intruder — which is why the config read as correct', () => {
      const framework = groups.find((g) => g.name === 'framework');
      expect(framework?.test?.test(LOCALE_MODULE)).toBe(false);
      expect(framework?.test?.test(DATA_MODULE)).toBe(false);
    });

    it.each([
      ['the locale catalogue', LOCALE_MODULE, 'i18n-locales'],
      ['the ObjectStack data adapter', DATA_MODULE, 'data-adapter'],
    ])('routes %s to `%s` at a priority `framework` cannot tie', (_what, id, expected) => {
      const framework = groups.find((g) => g.name === 'framework');
      expect(framework).toBeDefined();

      const claiming = claimants(id);
      // Fails closed: no claimant is an error, never a silent pass.
      expect(claiming.length).toBeGreaterThan(0);
      expect(claiming[0].name).toBe(expected);

      // The pin. A TIE is what put the catalogue in `framework`, so equality
      // here is a failure exactly like inversion is.
      expect(claiming[0].priority).toBeGreaterThan(framework!.priority);
    });

    it('leaves no second claimant at the winner`s priority', () => {
      for (const id of [LOCALE_MODULE, DATA_MODULE]) {
        const claiming = claimants(id);
        const top = claiming[0].priority;
        expect(claiming.filter((g) => g.priority === top)).toHaveLength(1);
      }
    });
  });

  it('budgets the chunk the catalogue now lands in', () => {
    // A re-attribution that moved 446 KB into a chunk with no ceiling would
    // pass every case above while weakening the gate: the aggregate is the only
    // line left over those bytes, and it is the loosest one.
    expect(PER_CHUNK_GZIP_CEILINGS).toHaveProperty('i18n-locales');
    expect(claimants(LOCALE_MODULE)[0].name).toBe('i18n-locales');
  });
});

describe('ceiling sensitivity, judged live (objectui#5924)', () => {
  /**
   * A v2 report totalling exactly `totalGzipBytes`, carrying the budgeted
   * chunks at their measured sizes and the remainder of the closure as one
   * filler chunk — the shape a real report has, where the budgeted names are a
   * minority of the total.
   */
  function sensitivityReport(totalGzipBytes: number, sizes: Record<string, number> = {}) {
    const measured: Record<string, number> = { ...PER_CHUNK_BASELINE, ...sizes };
    const named = [
      { fileName: 'assets/index-A.js', name: 'index', bytes: 0, gzipBytes: 25_910 },
      ...Object.entries(measured).map(([name, gzipBytes]) => ({
        fileName: `assets/${name}-hash.js`,
        name,
        bytes: 0,
        gzipBytes,
      })),
    ];
    const files = [
      ...named,
      {
        fileName: 'assets/rest-of-closure.js',
        name: 'rest-of-closure',
        bytes: 0,
        gzipBytes: totalGzipBytes - named.reduce((n, f) => n + f.gzipBytes, 0),
      },
    ];
    return report({
      files,
      eagerChunkCount: files.length,
      eagerGzipBytes: totalGzipBytes,
      eagerRawBytes: 0,
    });
  }

  /** The ceiling this file shipped before objectui#5924 re-baselined it. */
  const CEILING_BEFORE_5924 = 4_086_000;

  /**
   * The payload objectui#5924 measured, pinned as its own constant.
   *
   * It used to read `BASELINE.gzipBytes`, which made a HISTORICAL incident
   * reproduction track today's measurement: objectui#6683 moved the baseline
   * and the recorded "8.63x" became arithmetic about a moment that never
   * happened. A reproduction of a past reading has to carry that reading.
   */
  const BASELINE_AT_5924 = 3_299_898;

  it('reds on the drift objectui#5924 recorded: 8.6x the regression above the live payload', () => {
    const result = evaluateHeadroomSensitivity({
      report: sensitivityReport(BASELINE_AT_5924),
      budgetBytes: CEILING_BEFORE_5924,
    });
    expect(result.status).toBe('error');
    expect(result.blind).toEqual(['aggregate']);
    expect(result.message).toContain('DRIFTED');
    // The multiple, so the failure states HOW blind rather than merely that it is.
    expect(result.message).toContain('8.63x');
    // ...and the constant to lower, so the fix is one named edit.
    expect(result.message).toContain('MAX_EAGER_CLOSURE_GZIP_BYTES');
  });

  it('is the check the frozen-constant assertion structurally could not be', () => {
    // Same moment, same payload, the assertion that was supposed to guard it:
    // the two constants of the day satisfied it comfortably, which is why the
    // suite was green through the run above.
    expect(CEILING_BEFORE_5924 - 4_005_911).toBeLessThan(REGRESSION_THIS_GATE_MUST_CATCH_BYTES);
  });

  it('passes on the constants and the measurement this file ships today', () => {
    const result = evaluateHeadroomSensitivity({ report: sensitivityReport(BASELINE.gzipBytes) });
    expect(result.status).toBe('pass');
    expect(result.blind).toEqual([]);
    // Every ceiling in the file is weighed, not just the aggregate one: the
    // population objectui#5490 grew to four is the population judged here.
    expect(result.sites.map((site) => site.key)).toEqual([
      'aggregate',
      ...Object.keys(PER_CHUNK_GZIP_CEILINGS),
    ]);
    // A passing run still prints every measurement, so a reader watching a
    // ceiling drift upward sees it coming rather than the day it reds. The
    // literal is `BASELINE.gzipBytes` rendered, re-taken each time the baseline
    // moves (objectui#6683 down to 3177.7, objectui#6776 down to 3146.8) — a
    // rendering derived in the test would agree with the renderer by
    // construction and pin nothing.
    expect(result.message).toContain('3146.8');
  });

  it('is exactly one regression wide, from either side of the line', () => {
    const atTheLine = MAX_EAGER_CLOSURE_GZIP_BYTES - REGRESSION_THIS_GATE_MUST_CATCH_BYTES;
    expect(evaluateHeadroomSensitivity({ report: sensitivityReport(atTheLine + 1) }).status).toBe(
      'pass',
    );
    expect(evaluateHeadroomSensitivity({ report: sensitivityReport(atTheLine) }).status).toBe(
      'error',
    );
  });

  it('judges the per-chunk ceilings too — the population is four ceilings, not one', () => {
    const result = evaluateHeadroomSensitivity({
      report: sensitivityReport(BASELINE.gzipBytes, {
        framework: PER_CHUNK_GZIP_CEILINGS.framework - REGRESSION_THIS_GATE_MUST_CATCH_BYTES,
      }),
    });
    expect(result.status).toBe('error');
    expect(result.blind).toEqual(['framework']);
    expect(result.message).toContain("PER_CHUNK_GZIP_CEILINGS['framework']");
  });

  it('leaves a ceiling BELOW the payload to the size verdict, and says so', () => {
    // Negative headroom is an over-budget bundle. Reporting it here as well
    // would turn one regression into an error and teach a reader that exit 2
    // does not mean what the file says it means.
    const result = evaluateHeadroomSensitivity({
      report: sensitivityReport(MAX_EAGER_CLOSURE_GZIP_BYTES + 500_000),
    });
    expect(result.status).toBe('pass');
    expect(result.message).toContain('the size verdict owns this row');
  });

  it('errors when there is no report — a ceiling with no measurement is not sensitive', () => {
    const result = evaluateHeadroomSensitivity({ report: null });
    expect(result.status).toBe('error');
    expect(result.message).toContain('broken gauge');
  });

  it('errors on a report it cannot trust rather than judging drift from a bad number', () => {
    const result = evaluateHeadroomSensitivity({
      report: { ...sensitivityReport(BASELINE.gzipBytes), reportVersion: 1 },
    });
    expect(result.status).toBe('error');
    expect(result.blind).toEqual([]);
  });

  it('refuses to judge a ceiling whose chunk is absent, instead of reading it as drifted', () => {
    // The wrong-reason trap: a budgeted chunk that is not in the report weighs
    // zero, so its whole ceiling would look like headroom — "drifted", the
    // right exit code for the wrong reason, on a run the per-chunk half already
    // explains correctly.
    const base = sensitivityReport(BASELINE.gzipBytes);
    const files = base.files.filter((f) => f.name !== 'ui-components');
    const result = evaluateHeadroomSensitivity({
      report: report({
        files,
        eagerChunkCount: files.length,
        eagerGzipBytes: files.reduce((n, f) => n + f.gzipBytes, 0),
        eagerRawBytes: 0,
      }),
    });
    expect(result.status).toBe('error');
    expect(result.blind).toEqual([]);
    expect(result.message).toContain('ui-components');
    expect(result.message).toContain('absent');
  });

  /**
   * The acceptance test of objectui#5924, pinned so it cannot quietly come
   * undone. Measured on `48e53814e`: an eager `@objectstack/spec/cloud`
   * namespace import into `apps/console/src/main.tsx` — a use the bundler
   * cannot fold away — put 158,006 gzipped bytes into the eager closure, and
   * removing it returned the measurement to 3,299,898 exactly, so the movement
   * is the injection and not build noise.
   */
  it('the demonstrated regression: green under the old ceiling, red under the new one', () => {
    const INJECTED = BASELINE.gzipBytes + 158_006;
    // 1.7x the incident this gate was built to catch.
    expect(INJECTED - BASELINE.gzipBytes).toBeGreaterThan(REGRESSION_THIS_GATE_MUST_CATCH_BYTES);

    const injected = sensitivityReport(INJECTED);
    expect(
      evaluateClosureBudget({ report: injected, budgetBytes: CEILING_BEFORE_5924 }).status,
    ).toBe('pass');
    expect(evaluateClosureBudget({ report: injected }).status).toBe('fail');
  });
});

describe('renderTopChunks', () => {
  it('names the biggest eager chunks so a failure has suspects', () => {
    const lines = renderTopChunks(report(), 2).split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('vendor-objectstack-B.js');
    expect(lines[1]).toContain('framework-C.js');
  });

  it('does not throw on a report with no chunk list', () => {
    expect(renderTopChunks({})).toBe('');
  });
});

describe('main', () => {
  /**
   * Hermetic by construction: `main`'s environment is INJECTED here, never
   * inherited from the process.
   *
   * objectui#6245 — `main(argv, env = process.env)` is the right PRODUCTION
   * default, but a test that leans on it is measuring the machine it runs on.
   * `GITHUB_EVENT_NAME=pull_request` is ambient inside GitHub Actions, so this
   * helper omitting `env` silently switched the ceiling-freshness half ON in
   * CI — where its two source paths are unset, so the half correctly returned
   * `error` and `main` correctly returned 2, into four assertions written when
   * 0 and 1 were the only outcomes it could produce. Every one of them passed
   * locally, for the single reason that proves nothing: the variable happened
   * not to be set.
   *
   * `GITHUB_EVENT_NAME` is absent from the injected object ON PURPOSE — that is
   * what makes these cases exercise the non-pull_request path deterministically
   * instead of by luck. Pass it through `env` to opt a case in.
   */
  function run(reportBody: unknown, env: Record<string, string> = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'closure-budget-'));
    const reportPath = path.join(dir, 'eager-closure.json');
    const outputPath = path.join(dir, 'github-output');
    if (reportBody !== undefined) fs.writeFileSync(reportPath, JSON.stringify(reportBody));
    try {
      const code = main(['--report', reportPath], { GITHUB_OUTPUT: outputPath, ...env });
      const outputs = Object.fromEntries(
        fs
          .readFileSync(outputPath, 'utf8')
          .split('\n')
          .filter(Boolean)
          .map((line) => line.split('=') as [string, string]),
      );
      return { code, outputs };
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  /**
   * The guard for the defect above, and it has to be a TEST rather than a note
   * in the helper: the failure is invisible on a developer machine and appears
   * only inside Actions, which is the worst place to find it — on the next
   * person's unrelated PR. Setting the variable here reproduces CI's ambient
   * environment in-process, so if `run()` ever goes back to inheriting
   * `process.env` this reds locally, immediately, on the change that caused it.
   */
  it('is unaffected by an ambient GITHUB_EVENT_NAME, the way Actions sets it', () => {
    const previous = process.env.GITHUB_EVENT_NAME;
    process.env.GITHUB_EVENT_NAME = 'pull_request';
    try {
      const { code, outputs } = run(budgeted());
      expect(code).toBe(0);
      // The freshness half must stay dormant. This run injects no base-branch
      // sources, so an ACTIVE half would correctly report `error` and exit 2 —
      // precisely how the ambient variable turned four green assertions red.
      expect(outputs.closure_freshness_status).toBe('');
    } finally {
      if (previous === undefined) delete process.env.GITHUB_EVENT_NAME;
      else process.env.GITHUB_EVENT_NAME = previous;
    }
  });

  // `budgeted()` rather than the bare `report()` fixture: since objectui#5490
  // the checker weighs BOTH halves, and a report missing the budgeted chunks is
  // an error — which is the per-chunk half working, not a fixture detail.
  it('exits 0 and publishes the measurement when within budget', () => {
    const fixture = budgeted();
    const { code, outputs } = run(fixture);
    expect(code).toBe(0);
    expect(outputs.closure_status).toBe('pass');
    // DERIVED from the fixture, not retyped. This was the literal `'5'`, which
    // counted the budgeted chunks plus `index` and `rest-of-closure` — so
    // objectui#7399 adding a fourth per-chunk ceiling reddened an assertion
    // about the FIXTURE while the gate under test behaved correctly. The number
    // this case is actually about is "the report's chunk count, echoed".
    expect(outputs.closure_chunks).toBe(String(fixture.files.length));
    expect(outputs.closure_gzip_kb).toBe('3146.8');
  });

  it('exits 1 — a verdict about the BUNDLE — when over budget', () => {
    const { code, outputs } = run(report({ eagerGzipBytes: 9_000_000, files: [
      { fileName: 'assets/huge.js', name: 'huge', bytes: 30_000_000, gzipBytes: 9_000_000 },
    ], eagerChunkCount: 1, totalChunkCount: 507 }));
    // eagerChunkCount 1 is itself refused, so this run proves the ORDER: a
    // report that cannot be trusted is an error even when it is also over.
    expect(code).toBe(2);
    expect(outputs.closure_status).toBe('error');
  });

  it('exits 1 with a real over-budget report', () => {
    // Every per-chunk ceiling holds and the TOTAL is still over: the aggregate
    // half is not made redundant by the per-chunk one — bytes can also arrive
    // spread across chunks nobody budgets.
    const base = budgeted();
    const files = [
      ...base.files,
      { fileName: 'assets/huge.js', name: 'huge', bytes: 30_000_000, gzipBytes: MAX_EAGER_CLOSURE_GZIP_BYTES },
    ];
    const { code, outputs } = run(
      report({
        files,
        eagerChunkCount: files.length,
        eagerGzipBytes: files.reduce((n, f) => n + f.gzipBytes, 0),
        eagerRawBytes: 0,
      }),
    );
    expect(code).toBe(1);
    expect(outputs.closure_status).toBe('fail');
    expect(outputs.closure_chunk_status).toBe('pass');
    expect(outputs.closure_gzip_kb).not.toBe('');
  });

  /**
   * A v2 report at the measured per-chunk sizes, totalling `BASELINE.gzipBytes`
   * plus `totalDelta`.
   *
   * ⚠️ The filler chunk is not padding. Before objectui#5924 this fixture
   * carried only the budgeted names, so its total was ~1.8 MB against a 3.3 MB
   * ceiling — a shape `main` now (correctly) calls a BLIND ceiling and exits 2
   * on. A report whose total sits far below the aggregate line is not a
   * within-budget bundle to be asserted `pass`; it is the defect this card
   * fixed. So the fixture carries the rest of the closure, as a real report
   * does, and `totalDelta` is how a test moves the total on purpose.
   */
  function budgeted(sizes: Record<string, number> = {}, totalDelta = 0) {
    const measured: Record<string, number> = { ...PER_CHUNK_BASELINE, ...sizes };
    const named = [
      { fileName: 'assets/index-A.js', name: 'index', bytes: 0, gzipBytes: 25_910 },
      ...Object.entries(measured).map(([name, gzipBytes]) => ({
        fileName: `assets/${name}-hash.js`,
        name,
        bytes: 0,
        gzipBytes,
      })),
    ];
    // Derived from the BASELINE sizes, not from `named`, so an override in
    // `sizes` moves the total the way a real chunk growing would.
    const baselineNamed =
      25_910 + Object.values(PER_CHUNK_BASELINE).reduce((n, bytes) => n + bytes, 0);
    const files = [
      ...named,
      {
        fileName: 'assets/rest-of-closure.js',
        name: 'rest-of-closure',
        bytes: 0,
        gzipBytes: BASELINE.gzipBytes - baselineNamed + totalDelta,
      },
    ];
    return report({
      files,
      eagerChunkCount: files.length,
      eagerGzipBytes: files.reduce((n, f) => n + f.gzipBytes, 0),
      eagerRawBytes: 0,
    });
  }

  it('exits 0 and publishes both verdicts when every budget holds', () => {
    const { code, outputs } = run(budgeted());
    expect(code).toBe(0);
    expect(outputs.closure_status).toBe('pass');
    expect(outputs.closure_chunk_status).toBe('pass');
  });

  /**
   * The reason this half exists, as one run: the TOTAL is inside the aggregate
   * ceiling — the aggregate half is green — and a single chunk has still grown
   * past its own line. Before objectui#5490 that run exited 0.
   */
  it('exits 1 when one chunk is over its ceiling while the aggregate is green', () => {
    const { code, outputs } = run(
      budgeted({ 'vendor-objectstack': PER_CHUNK_GZIP_CEILINGS['vendor-objectstack'] + 1 }),
    );
    expect(code).toBe(1);
    expect(outputs.closure_status).toBe('pass');
    expect(outputs.closure_chunk_status).toBe('fail');
  });

  it('exits 2 when a budgeted chunk is absent — measuring nothing is not passing', () => {
    const base = budgeted();
    const files = base.files.filter((f) => f.name !== 'ui-components');
    const { code, outputs } = run(
      report({
        files,
        eagerChunkCount: files.length,
        eagerGzipBytes: files.reduce((n, f) => n + f.gzipBytes, 0),
        eagerRawBytes: 0,
      }),
    );
    expect(code).toBe(2);
    // The aggregate half is perfectly happy — which is precisely why the
    // per-chunk half may not be silent about it.
    expect(outputs.closure_status).toBe('pass');
    expect(outputs.closure_chunk_status).toBe('error');
  });

  /**
   * objectui#5924: the run that used to be the file's blind spot. Both size
   * halves are delighted — nothing is over any line — and the gate still has to
   * stop, because neither of those green ticks means anything at this distance.
   */
  it('exits 2 when a ceiling has drifted out of range of the regression it must catch', () => {
    const { code, outputs } = run(budgeted({}, -REGRESSION_THIS_GATE_MUST_CATCH_BYTES));
    expect(code).toBe(2);
    expect(outputs.closure_status).toBe('pass');
    expect(outputs.closure_chunk_status).toBe('pass');
    expect(outputs.closure_headroom_status).toBe('error');
  });

  /**
   * The ordering objectui#5490 established over two halves, held over three:
   * `error` outranks `fail`, whichever half noticed. `performance-budget.yml`
   * maps exit 2 to `budget_status=error` and any other non-zero to `fail`, so
   * collapsing this to 1 would report a gauge that cannot be trusted as a size
   * regression.
   */
  it('reports the GAUGE verdict when one ceiling is blind and another is over', () => {
    const { code, outputs } = run(
      budgeted({ 'vendor-objectstack': PER_CHUNK_GZIP_CEILINGS['vendor-objectstack'] + 1 }, -200_000),
    );
    expect(code).toBe(2);
    expect(outputs.closure_chunk_status).toBe('fail');
    expect(outputs.closure_headroom_status).toBe('error');
  });

  it('exits 2 on a report from a build that predates per-chunk names', () => {
    const base = budgeted();
    const { code, outputs } = run({ ...base, reportVersion: 1 });
    expect(code).toBe(2);
    expect(outputs.closure_status).toBe('error');
    expect(outputs.closure_chunk_status).toBe('error');
  });

  it('exits 2 — a verdict about the GAUGE — when there is no report', () => {
    const { code, outputs } = run(undefined);
    expect(code).toBe(2);
    expect(outputs.closure_status).toBe('error');
    // The keys are published EMPTY, never as a number: the renderer's
    // "not measured" branch keys off exactly that emptiness, and a stale
    // number here would render as a verdict about a bundle nobody weighed.
    expect(outputs.closure_gzip_kb).toBe('');
    expect(outputs.closure_chunks).toBe('');
  });
});

/**
 * objectui#6245 — the fourth half. `Bundle Analysis` is a required context, and
 * GitHub does not re-run a PR's checks when the base branch moves, so a green
 * verdict can be computed against ceilings `main` has since replaced.
 *
 * Not hypothetical: run 32804357171 started 6m50s after `0409b766d` lowered the
 * aggregate ceiling from 4,086,000 to 3,345,000 and published
 * `BUDGET_CLOSURE_BUDGET_KB: 3990.2` — 4,086,000 bytes — with conclusion
 * `success`. `theRealIncident` below replays exactly that pair of numbers.
 */
describe('ceiling freshness (objectui#6245)', () => {
  const checkerSource = fs.readFileSync(checkerPath, 'utf8');

  /**
   * A copy of the real checker with one ceiling moved, so these fixtures track
   * a future re-baseline instead of pinning today's digits in a second place.
   *
   * The `expect` is the guard on the guard: a `String.replace` whose pattern
   * matches nothing returns the subject unchanged and throws nothing, which
   * would leave every case below comparing a file with itself and passing for
   * the wrong reason.
   */
  function withAggregateCeiling(bytes: number) {
    const moved = checkerSource.replace(
      /^export const MAX_EAGER_CLOSURE_GZIP_BYTES = .*;$/m,
      `export const MAX_EAGER_CLOSURE_GZIP_BYTES = ${bytes};`,
    );
    expect(moved, 'the fixture anchor no longer matches the real declaration').not.toBe(
      checkerSource,
    );
    return moved;
  }

  const onPullRequest = (overrides: Record<string, unknown> = {}) =>
    evaluateCeilingFreshness({
      eventName: 'pull_request',
      headSource: checkerSource,
      prBaseSource: checkerSource,
      baseSource: checkerSource,
      baseRef: 'main',
      ...overrides,
    });

  describe('extractCeilingDeclarations', () => {
    it('finds every constant a verdict is computed from, in the real file', () => {
      const { declarations, missing } = extractCeilingDeclarations(checkerSource);
      expect(missing).toEqual([]);
      expect([...declarations.keys()]).toEqual([...VERDICT_CEILING_CONSTANTS]);
      expect(declarations.get('MAX_EAGER_CLOSURE_GZIP_BYTES')).toBe(
        String(MAX_EAGER_CLOSURE_GZIP_BYTES),
      );
    });

    it('reads an expression as text, so both sides of a comparison are read alike', () => {
      // `89 * 1024` must not be evaluated: the base-branch side is a blob that
      // cannot be imported, so an evaluated 91136 here would never match it.
      expect(extractCeilingDeclarations(checkerSource).declarations.get(
        'REGRESSION_THIS_GATE_MUST_CATCH_BYTES',
      )).toBe('89 * 1024');
    });

    it('erases formatting that cannot move a ceiling', () => {
      const a = "export const MAX_EAGER_CLOSURE_GZIP_BYTES = 3_345_000;";
      const b = "export const MAX_EAGER_CLOSURE_GZIP_BYTES =\n  3345000;";
      const read = (s: string) =>
        extractCeilingDeclarations(s, ['MAX_EAGER_CLOSURE_GZIP_BYTES']).declarations.get(
          'MAX_EAGER_CLOSURE_GZIP_BYTES',
        );
      expect(read(a)).toBe(read(b));
    });

    it('erases comments and trailing commas inside an object ceiling', () => {
      const plain = "export const PER_CHUNK_GZIP_CEILINGS = Object.freeze({ a: 1, b: 2 });";
      const noisy =
        'export const PER_CHUNK_GZIP_CEILINGS = Object.freeze({\n' +
        '  // objectui#5490 — why this one is here\n' +
        '  a: 1,\n' +
        '  b: 2,\n' +
        '});';
      const read = (s: string) =>
        extractCeilingDeclarations(s, ['PER_CHUNK_GZIP_CEILINGS']).declarations.get(
          'PER_CHUNK_GZIP_CEILINGS',
        );
      expect(read(noisy)).toBe(read(plain));
    });

    it('reports a name it cannot find rather than skipping the comparison', () => {
      const { declarations, missing } = extractCeilingDeclarations('export const OTHER = 1;');
      expect(missing).toEqual([...VERDICT_CEILING_CONSTANTS]);
      expect(declarations.size).toBe(0);
    });

    it('does not mistake a nested `;` for the end of the declaration', () => {
      const source =
        'export const PER_CHUNK_GZIP_CEILINGS = Object.freeze({ a: 1, b: 2 });\n' +
        'export const AFTER = 9;';
      expect(
        extractCeilingDeclarations(source, ['PER_CHUNK_GZIP_CEILINGS']).declarations.get(
          'PER_CHUNK_GZIP_CEILINGS',
        ),
      ).toBe('Object.freeze({ a: 1, b: 2 })');
    });
  });

  describe('evaluateCeilingFreshness', () => {
    it('is not applicable off a pull_request — the checkout IS the branch', () => {
      for (const eventName of ['push', 'workflow_dispatch', undefined]) {
        const verdict = evaluateCeilingFreshness({ eventName, headSource: checkerSource });
        expect(verdict.status).toBe('not-applicable');
        expect(verdict.superseded).toEqual([]);
      }
    });

    it('passes when the base branch has not moved a ceiling since this checkout', () => {
      const verdict = onPullRequest();
      expect(verdict.status).toBe('pass');
      expect(verdict.moved).toEqual([]);
    });

    /**
     * The case that makes this a three-reading check and not a two-reading one.
     * A re-baseline PR differs from the base branch DELIBERATELY, and failing it
     * would make the one PR that must land unlandable.
     */
    it('passes a PR that re-baselines a ceiling itself', () => {
      const verdict = onPullRequest({ headSource: withAggregateCeiling(3_000_000) });
      expect(verdict.status).toBe('pass');
      expect(verdict.moved).toEqual([]);
      expect(verdict.superseded).toEqual([]);
    });

    it('passes when the base branch moved a ceiling and this checkout carries it', () => {
      const moved = withAggregateCeiling(3_000_000);
      const verdict = onPullRequest({ headSource: moved, baseSource: moved });
      expect(verdict.status).toBe('pass');
      expect(verdict.moved).toEqual(['MAX_EAGER_CLOSURE_GZIP_BYTES']);
      expect(verdict.superseded).toEqual([]);
      expect(verdict.message).toContain('already carries the new value');
    });

    it('ERRORS when the base branch replaced a ceiling this run weighed against', () => {
      const verdict = onPullRequest({ baseSource: withAggregateCeiling(3_000_000) });
      expect(verdict.status).toBe('error');
      expect(verdict.superseded).toEqual(['MAX_EAGER_CLOSURE_GZIP_BYTES']);
      expect(verdict.message).toContain(String(MAX_EAGER_CLOSURE_GZIP_BYTES));
      expect(verdict.message).toContain('3000000');
    });

    /**
     * The live incident, with its own numbers. #6229 moved the aggregate ceiling
     * from 4,086,000 to 3,345,000 at 03:06:37Z; a PR run seven minutes later was
     * still weighing against 4,086,000 and reported success.
     */
    it('catches the incident this card was filed for', () => {
      const theRealIncident = onPullRequest({
        headSource: withAggregateCeiling(4_086_000),
        prBaseSource: withAggregateCeiling(4_086_000),
        baseSource: withAggregateCeiling(3_345_000),
        prBaseSha: '48e53814e',
        baseSha: '0409b766d',
      });
      expect(theRealIncident.status).toBe('error');
      expect(theRealIncident.message).toContain('weighed here : 4086000');
      expect(theRealIncident.message).toContain('in force now : 3345000');
      expect(theRealIncident.message).toContain('48e53814e -> 0409b766d');
    });

    /**
     * The whole point of routing this to exit 2 rather than exit 1. A reader who
     * takes a freshness failure for a size failure goes hunting a regression
     * that is not there — and the fix they reach for is widening the ceiling,
     * which is the one thing this must never teach.
     */
    it('reads as a superseded ceiling and NOT as a bundle that grew', () => {
      const { message } = onPullRequest({ baseSource: withAggregateCeiling(3_000_000) });
      expect(message).toContain('NOTHING GREW');
      expect(message).toContain('not a size regression');
      expect(message).toContain('Do NOT widen a ceiling');
      expect(message).toMatch(/update this branch/i);
      // The size half's vocabulary must not appear here.
      expect(message).not.toMatch(/over the .* budget|over budget|BUDGET EXCEEDED/);
    });

    it('ERRORS rather than passing when the base branch could not be read', () => {
      for (const missing of ['prBaseSource', 'baseSource'] as const) {
        const verdict = onPullRequest({ [missing]: null });
        expect(verdict.status).toBe('error');
        expect(verdict.message).toContain('NOT that the ceilings agree');
      }
    });

    it('ERRORS rather than passing when a ceiling declaration cannot be located', () => {
      const verdict = onPullRequest({ baseSource: 'export const SOMETHING_ELSE = 1;' });
      expect(verdict.status).toBe('error');
      expect(verdict.message).toContain('could not be located');
      expect(verdict.message).toContain('MAX_EAGER_CLOSURE_GZIP_BYTES');
    });
  });

  /**
   * Through `main`, because the exit code and the published verdict are what the
   * workflow acts on — and because these two assertions hold against the whole
   * pipeline rather than one exported function.
   */
  describe('main folds freshness into the exit code', () => {
    /**
     * A within-budget report carrying the whole closure, not just the budgeted
     * chunks — a report holding only those is an ERROR (objectui#5924), so a
     * thinner fixture would exit 2 for the wrong reason and prove nothing about
     * freshness. Local rather than shared: `describe('main')` has its own copy
     * and reaching across describes to borrow it would couple these two blocks.
     */
    function healthyReport() {
      const named = [
        { fileName: 'assets/index-A.js', name: 'index', bytes: 0, gzipBytes: 25_910 },
        ...Object.entries(PER_CHUNK_BASELINE).map(([name, gzipBytes]) => ({
          fileName: `assets/${name}-hash.js`,
          name,
          bytes: 0,
          gzipBytes,
        })),
      ];
      const namedTotal = named.reduce((n, f) => n + f.gzipBytes, 0);
      const files = [
        ...named,
        {
          fileName: 'assets/rest-of-closure.js',
          name: 'rest-of-closure',
          bytes: 0,
          gzipBytes: BASELINE.gzipBytes - namedTotal,
        },
      ];
      return report({
        files,
        eagerChunkCount: files.length,
        eagerGzipBytes: files.reduce((n, f) => n + f.gzipBytes, 0),
        eagerRawBytes: 0,
      });
    }

    function runWithEnv({
      eventName,
      prBase,
      base,
    }: {
      eventName: string;
      prBase?: string;
      base?: string;
    }) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'closure-freshness-'));
      const reportPath = path.join(dir, 'eager-closure.json');
      const outputPath = path.join(dir, 'github-output');
      fs.writeFileSync(reportPath, JSON.stringify(healthyReport()));
      const write = (name: string, body: string) => {
        const at = path.join(dir, name);
        fs.writeFileSync(at, body);
        return at;
      };
      try {
        const code = main(['--report', reportPath], {
          GITHUB_OUTPUT: outputPath,
          GITHUB_EVENT_NAME: eventName,
          EAGER_CLOSURE_PR_BASE_SOURCE: prBase === undefined ? undefined : write('pr-base.mjs', prBase),
          EAGER_CLOSURE_BASE_SOURCE: base === undefined ? undefined : write('base.mjs', base),
          EAGER_CLOSURE_BASE_REF: 'main',
        });
        const outputs = Object.fromEntries(
          fs
            .readFileSync(outputPath, 'utf8')
            .split('\n')
            .filter(Boolean)
            .map((line) => {
              const at = line.indexOf('=');
              return [line.slice(0, at), line.slice(at + 1)] as [string, string];
            }),
        );
        return { code, outputs };
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }

    it('exits 2 and publishes `error` when the ceiling it used was superseded', () => {
      const { code, outputs } = runWithEnv({
        eventName: 'pull_request',
        prBase: checkerSource,
        base: withAggregateCeiling(3_000_000),
      });
      // 2, not 1: the bundle is under budget and nothing grew.
      expect(code).toBe(2);
      expect(outputs.closure_freshness_status).toBe('error');
      expect(outputs.closure_status).toBe('pass');
      expect(outputs.closure_headroom_status).toBe('pass');
    });

    it('exits 2 on a pull_request run whose base branch was never resolved', () => {
      const { code, outputs } = runWithEnv({ eventName: 'pull_request' });
      expect(code).toBe(2);
      expect(outputs.closure_freshness_status).toBe('error');
    });

    it('publishes an EMPTY freshness verdict off a pull_request, never a pass', () => {
      // An absent half is filtered out of the PR comment; a `pass` would assert
      // a comparison that never happened.
      const { code, outputs } = runWithEnv({ eventName: 'push' });
      expect(code).toBe(0);
      expect(outputs.closure_freshness_status).toBe('');
    });
  });
});

/**
 * The checker can only be correct if the workflow keeps feeding it and the
 * build keeps emitting the report. Neither half is reachable from a unit test.
 */
describe('performance-budget.yml + vite.config.ts contract', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const viteConfig = fs.readFileSync(viteConfigPath, 'utf8');

  it('runs the closure checker in the budget step', () => {
    expect(workflow).toContain('node scripts/check-eager-closure-budget.mjs');
  });

  it('keeps the entry-chunk budget alongside it', () => {
    // Replacing a blind gauge is not licence to drop the check already there.
    expect(workflow).toContain('MAX_ENTRY_GZIP_KB=350');
  });

  it('measures the closure even when the entry chunk is over budget', () => {
    // The entry check used to `exit 1` on breach. If it still did, a fat entry
    // chunk would hide the number that actually governs a page load.
    const step = workflow.slice(workflow.indexOf('MAX_ENTRY_GZIP_KB=350'));
    const entryVerdict = step.indexOf('ENTRY BUDGET EXCEEDED');
    const closureRun = step.indexOf('node scripts/check-eager-closure-budget.mjs');
    expect(entryVerdict).toBeGreaterThan(-1);
    expect(closureRun).toBeGreaterThan(entryVerdict);
  });

  it('maps the gauge-failure exit code to `error`, not to a size verdict', () => {
    expect(workflow).toContain('if [ "$CLOSURE_CODE" -eq 2 ]; then');
    const branch = workflow.slice(workflow.indexOf('if [ "$CLOSURE_CODE" -eq 2 ]; then'));
    expect(branch.slice(0, 400)).toContain('budget_status=error');
  });

  it('emits the report from a plugin that is not skipped on CI', () => {
    // `compression` and `visualizer` sit behind `...(!isCI ? [` — the budget
    // runs ON CI, so the report emitter must not join them there.
    expect(viteConfig).toContain('emitEagerClosureReport()');
    const registration = viteConfig.indexOf('emitEagerClosureReport(),');
    const ciOnlyBlock = viteConfig.indexOf('...(!isCI ? [');
    expect(registration).toBeGreaterThan(-1);
    expect(ciOnlyBlock).toBeGreaterThan(registration);
  });

  it('agrees with the emitter about the report version', () => {
    // The two halves of one contract, in two files. A silent disagreement here
    // is the worst shape available: the checker would refuse every report, or
    // (the version it was bumped to guard) read a report missing the very field
    // the per-chunk ceilings key on.
    const emitted = viteConfig.match(/reportVersion: (\d+)/);
    expect(emitted?.[1]).toBe(String(SUPPORTED_REPORT_VERSION));
  });

  it('publishes each chunk\'s own name, and refuses a member without one', () => {
    const plugin = viteConfig.slice(viteConfig.indexOf('function emitEagerClosureReport'));
    const body = plugin.slice(0, plugin.indexOf('\n}\n'));
    expect(body).toContain('chunks.get(fileName)?.name');
    expect(body).toContain('return { fileName, name,');
    // An unnamed member must stop the build rather than be published: it would
    // reach the checker as bytes no per-chunk ceiling can find.
    expect(body).toContain('carries no chunk');
  });

  /**
   * The static half of the mapping pin. The runtime half (a budgeted chunk
   * absent from the REPORT is an error) needs a build; this one reds in a unit
   * run the moment an `advancedChunks` group is renamed out from under a
   * ceiling — the rename and the stale ceiling are then one failing test apart
   * rather than one green CI apart.
   */
  it.each(Object.keys(PER_CHUNK_GZIP_CEILINGS))(
    'budgets `%s`, which is a real advancedChunks group in the console config',
    (name) => {
      expect(viteConfig).toContain(`{ name: '${name}',`);
    },
  );

  it('writes the report where the checker looks for it', () => {
    expect(viteConfig).toContain("reportFileName = 'eager-closure.json'");
    const checker = fs.readFileSync(
      path.join(repoRoot, 'scripts/check-eager-closure-budget.mjs'),
      'utf8',
    );
    expect(checker).toContain("'apps/console/dist/eager-closure.json'");
  });

  it('follows static imports only — dynamic edges are the lazy boundary', () => {
    const plugin = viteConfig.slice(viteConfig.indexOf('function emitEagerClosureReport'));
    const body = plugin.slice(0, plugin.indexOf('\n}\n'));
    expect(body).toContain('chunks.get(fileName)?.imports ?? []');
    // The queue may only ever be fed from the STATIC import list. (Plain
    // `not.toContain('dynamicImports')` would trip on the counter-probe's own
    // message, which names the field it is guarding against.)
    expect(body).not.toMatch(/for \(const \w+ of [^)]*dynamicImports/);
  });
});

/**
 * The prose attached to the two baselines, CHECKED rather than argued
 * (objectui#7046).
 *
 * {@link VERDICT_CEILING_CONSTANTS} deliberately excludes `BASELINE` and
 * `PER_CHUNK_BASELINE` — no verdict is computed from them, so the freshness
 * check that guards every other constant in this file structurally cannot see
 * them, and the only thing describing them is a comment. objectui#6778 is what
 * that costs: one paragraph attached to `PER_CHUNK_BASELINE` named a commit
 * three re-baselines out of date as what `BASELINE` carried, computed its
 * arithmetic against that retired reading, and drew the REVERSE of the verdict
 * the same script printed in the same run. It survived long enough to be copied
 * verbatim into a second card.
 *
 * Everything here is a POSITIVE pin: a live value the prose claims must equal
 * the value the module actually exports. The blanket negative pin the card
 * offered as (b) — "the attached block carries no OTHER commit hash" — was
 * measured and deliberately NOT shipped: both blocks legitimately cite
 * superseded hashes as history (`bd2a7ec50` under `BASELINE`, and every one of
 * the five under `PER_CHUNK_BASELINE`, which carries no commit of its own), so
 * (b) is red on an honest file before any mutation and no marker distinguishes
 * the two senses without rewriting the narrative comments. See the PR body for
 * the full reading.
 */
describe('the prose attached to the baselines (objectui#7046)', () => {
  const checkerSource = fs.readFileSync(checkerPath, 'utf8');

  /**
   * The documentation ATTACHED to one exported constant, located structurally —
   * never by a line number, which objectui#6778 demonstrated three times over
   * rots within days.
   *
   * "Attached" is the JSDoc block ending immediately before the
   * `export const NAME` declaration PLUS every comment lexically inside that
   * declaration, with the code itself stripped out. Both halves are load-bearing
   * and neither is a convenience:
   *
   *   - the leading block alone is not enough. Measured on `main` when this was
   *     written, `BASELINE`'s leading block carries no commit hash at all — the
   *     sentence naming the commit the measurement was taken on is the JSDoc on
   *     the `gzipBytes` FIELD, inside the object literal. Scoping there would
   *     make the positive pin below red on an honest file.
   *   - the declaration TEXT is too much. `commit: '...'` would satisfy the pin
   *     by restating the constant — the prose about the value passing because it
   *     contains the value, which is this card's own defect one layer up.
   */
  function attachedDocs(source: string, exportName: string): { prose: string; code: string } {
    const declaration = new RegExp(String.raw`^export const ${exportName}\b`, 'm').exec(source);
    if (!declaration) throw new Error(`no \`export const ${exportName}\` in the checker`);
    const declStart = declaration.index;

    const before = source.slice(0, declStart).replace(/\s+$/, '');
    if (!before.endsWith('*/')) {
      throw new Error(`\`export const ${exportName}\` is not preceded by a block comment`);
    }
    const open = before.lastIndexOf('/**');
    if (open === -1) throw new Error(`unterminated JSDoc above \`export const ${exportName}\``);

    // Walk the initializer, skipping comments and string literals, until the
    // brackets it opened close again. Comments met on the way are the per-field
    // prose; everything else is code.
    const inner: string[] = [];
    let i = source.indexOf('=', declStart) + 1;
    let depth = 0;
    let opened = false;
    while (i < source.length) {
      const two = source.slice(i, i + 2);
      if (two === '/*') {
        const end = source.indexOf('*/', i + 2);
        if (end === -1) throw new Error(`unterminated comment inside ${exportName}`);
        inner.push(source.slice(i, end + 2));
        i = end + 2;
        continue;
      }
      if (two === '//') {
        const end = source.indexOf('\n', i);
        inner.push(source.slice(i, end));
        i = end;
        continue;
      }
      const c = source[i];
      if (c === "'" || c === '"' || c === '`') {
        i += 1;
        while (i < source.length && source[i] !== c) i += source[i] === '\\' ? 2 : 1;
        i += 1;
        continue;
      }
      if (c === '(' || c === '{' || c === '[') {
        depth += 1;
        opened = true;
      } else if (c === ')' || c === '}' || c === ']') {
        depth -= 1;
        if (opened && depth === 0) {
          i += 1;
          break;
        }
      } else if (!opened && c === ';') {
        break;
      }
      i += 1;
    }

    return { prose: [before.slice(open), ...inner].join('\n'), code: source.slice(declStart, i) };
  }

  /** Commit strings a constant carries AS DATA, found by walking its values. */
  function commitsCarriedBy(value: unknown): string[] {
    const found: string[] = [];
    const walk = (v: unknown): void => {
      if (typeof v === 'string') {
        if (/^[0-9a-f]{7,40}$/.test(v)) found.push(v);
        return;
      }
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(value);
    return [...new Set(found)];
  }

  /**
   * A sentence claiming what `BASELINE` CARRIES — present tense, the sense that
   * must be current — as opposed to a bare hash, which in this file is usually
   * history and correct as such. The distinction is grammatical, not statistical,
   * which is why this is a positive pin with no false-positive surface: nobody
   * writes "BASELINE's `x`" about a hash it used to carry.
   *
   * `(?<![A-Za-z0-9_])` is not decoration: without it `PER_CHUNK_BASELINE` in a
   * `{@link}` matches as `BASELINE`.
   */
  const CITES_BASELINE_COMMIT =
    /(?<![A-Za-z0-9_])(?:\{@link\s+BASELINE\}|BASELINE)(?:['’]s)?\s*\(?\s*`([0-9a-f]{7,40})`/g;

  const BASELINES = ['BASELINE', 'PER_CHUNK_BASELINE'] as const;

  it('locates the block attached to each baseline, and only that block', () => {
    const baseline = attachedDocs(checkerSource, 'BASELINE');
    const perChunk = attachedDocs(checkerSource, 'PER_CHUNK_BASELINE');

    // Controls that MUST hit: phrases verified to be inside each attached
    // block. A locator that quietly found the wrong span would pass every pin
    // below by scanning prose that says nothing about these constants.
    expect(baseline.prose).toContain('the previous baseline');
    expect(perChunk.prose).toContain('Provenance is per KEY');

    // ...and the neighbours are not swept in. Each baseline sits directly under
    // the ceiling it was measured for, whose block is much the larger of the two.
    expect(baseline.prose).not.toContain('Re-baselined DOWNWARD three times');
    expect(perChunk.prose).not.toContain('## Raising one');

    // The code is not prose. Without this the positive pin below would be
    // satisfiable by the `commit:` line itself.
    expect(baseline.code).toContain(`commit: '${BASELINE.commit}'`);
    expect(baseline.prose).not.toContain(`commit: '${BASELINE.commit}'`);
  });

  /**
   * (a), the positive pin: what the constant carries must be what its own prose
   * says it carries. Vacuous for `PER_CHUNK_BASELINE` today, which is a measured
   * fact about that constant and is pinned as such in the next case.
   */
  it.each(BASELINES)('pins every commit %s carries into its own attached prose', (name) => {
    const { prose } = attachedDocs(checkerSource, name);
    const carried = commitsCarriedBy(name === 'BASELINE' ? BASELINE : PER_CHUNK_BASELINE);
    expect(carried.filter((commit) => !prose.includes(commit))).toEqual([]);
  });

  /**
   * What each baseline carries AS DATA, recorded so the pin above cannot go
   * vacuous in silence. Measured on `main`: `BASELINE` carries exactly one
   * commit string; `PER_CHUNK_BASELINE` carries NONE — its per-key provenance
   * commits live only in prose, with no exported value to check them against,
   * which is why the pin above says nothing about it and the claim pin below is
   * what guards its block. Add a `commit` field there and this reds, and the pin
   * above starts covering it.
   */
  it('records what each baseline carries as data, so the pin cannot go vacuous', () => {
    expect(commitsCarriedBy(BASELINE)).toEqual([BASELINE.commit]);
    expect(commitsCarriedBy(PER_CHUNK_BASELINE)).toEqual([]);
  });

  /**
   * The objectui#6778 defect itself, as an assertion. The stale hash was in a
   * sentence in `PER_CHUNK_BASELINE`'s block about what `BASELINE` carried —
   * a cross-constant claim, which is precisely the shape the pin above cannot
   * see, because the block making the claim carries no commit of its own.
   */
  it('holds every "BASELINE carries X" claim in the attached prose to the live value', () => {
    const claims = BASELINES.flatMap((name) =>
      [...attachedDocs(checkerSource, name).prose.matchAll(CITES_BASELINE_COMMIT)].map((m) => ({
        name,
        text: m[0],
        cited: m[1] as string,
      })),
    );

    // Presence first: a rewrite that drops the sentence must red here rather
    // than silently unpin the block objectui#6778's stale claim lived in.
    expect(claims.map((claim) => claim.name)).toContain('PER_CHUNK_BASELINE');

    expect(claims.map((claim) => `${claim.name}: ${claim.text}`)).toEqual(
      claims.map((claim) => `${claim.name}: ${claim.text.replace(claim.cited, BASELINE.commit)}`),
    );
  });

  /**
   * `PER_CHUNK_BASELINE` carries no commit, but it does carry three chunk NAMES,
   * and its block assigns provenance per key — "Provenance is per KEY, not per
   * file, and saying so is the point". A key added or renamed without touching
   * that list is the same drift one column over: a measurement nothing explains.
   */
  it('pins every chunk name PER_CHUNK_BASELINE carries into its own attached prose', () => {
    const { prose } = attachedDocs(checkerSource, 'PER_CHUNK_BASELINE');
    expect(Object.keys(PER_CHUNK_BASELINE).filter((chunk) => !prose.includes(chunk))).toEqual([]);
  });
});
