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
  evaluateClosureBudget,
  evaluatePerChunkBudgets,
  main,
  measureChunksByName,
  renderTopChunks,
  validateReport,
} from '../check-eager-closure-budget.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflowPath = path.join(repoRoot, '.github/workflows/performance-budget.yml');
const viteConfigPath = path.join(repoRoot, 'apps/console/vite.config.ts');

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
  function run(reportBody: unknown) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'closure-budget-'));
    const reportPath = path.join(dir, 'eager-closure.json');
    const outputPath = path.join(dir, 'github-output');
    if (reportBody !== undefined) fs.writeFileSync(reportPath, JSON.stringify(reportBody));
    const previous = process.env.GITHUB_OUTPUT;
    process.env.GITHUB_OUTPUT = outputPath;
    try {
      const code = main(['--report', reportPath]);
      const outputs = Object.fromEntries(
        fs
          .readFileSync(outputPath, 'utf8')
          .split('\n')
          .filter(Boolean)
          .map((line) => line.split('=') as [string, string]),
      );
      return { code, outputs };
    } finally {
      if (previous === undefined) delete process.env.GITHUB_OUTPUT;
      else process.env.GITHUB_OUTPUT = previous;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // `budgeted()` rather than the bare `report()` fixture: since objectui#5490
  // the checker weighs BOTH halves, and a report missing the budgeted chunks is
  // an error — which is the per-chunk half working, not a fixture detail.
  it('exits 0 and publishes the measurement when within budget', () => {
    const { code, outputs } = run(budgeted());
    expect(code).toBe(0);
    expect(outputs.closure_status).toBe('pass');
    expect(outputs.closure_chunks).toBe('4');
    expect(outputs.closure_gzip_kb).toBe('1814.3');
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

  /** A v2 report at the measured per-chunk sizes, well inside the aggregate. */
  function budgeted(sizes: Record<string, number> = {}) {
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
