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
  REGRESSION_THIS_GATE_MUST_CATCH_BYTES,
  SUPPORTED_REPORT_VERSION,
  evaluateClosureBudget,
  main,
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
    { fileName: 'assets/index-A.js', bytes: 90_000, gzipBytes: 25_910 },
    { fileName: 'assets/vendor-objectstack-B.js', bytes: 5_000_000, gzipBytes: 1_529_129 },
    { fileName: 'assets/framework-C.js', bytes: 1_800_000, gzipBytes: 495_690 },
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
      const files = [{ fileName: 'assets/index-A.js', bytes: 90_000, gzipBytes: 25_910 }];
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

  it('exits 0 and publishes the measurement when within budget', () => {
    const { code, outputs } = run(report());
    expect(code).toBe(0);
    expect(outputs.closure_status).toBe('pass');
    expect(outputs.closure_chunks).toBe('3');
    expect(outputs.closure_gzip_kb).toBe('2002.7');
  });

  it('exits 1 — a verdict about the BUNDLE — when over budget', () => {
    const { code, outputs } = run(report({ eagerGzipBytes: 9_000_000, files: [
      { fileName: 'assets/huge.js', bytes: 30_000_000, gzipBytes: 9_000_000 },
    ], eagerChunkCount: 1, totalChunkCount: 507 }));
    // eagerChunkCount 1 is itself refused, so this run proves the ORDER: a
    // report that cannot be trusted is an error even when it is also over.
    expect(code).toBe(2);
    expect(outputs.closure_status).toBe('error');
  });

  it('exits 1 with a real over-budget report', () => {
    const huge = MAX_EAGER_CLOSURE_GZIP_BYTES + 1;
    const files = [
      { fileName: 'assets/index-A.js', bytes: 90_000, gzipBytes: 1 },
      { fileName: 'assets/huge.js', bytes: 30_000_000, gzipBytes: huge - 1 },
    ];
    const { code, outputs } = run(report({ files, eagerChunkCount: 2, eagerGzipBytes: huge }));
    expect(code).toBe(1);
    expect(outputs.closure_status).toBe('fail');
    expect(outputs.closure_gzip_kb).not.toBe('');
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
