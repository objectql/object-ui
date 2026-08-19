import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * objectui#5304 — `Build & E2E` hung inside `apt-get update` and was cancelled
 * at the 30-minute job ceiling, three times, with a byte-identical last line:
 *
 *   Get:5 https://archive.ubuntu.com/ubuntu noble-security InRelease [126 kB]
 *
 *   PR #5290 job 95986117935  07:05:48 -> cancelled 07:34:39 (30m14s)
 *   PR #5290 job 95993643751  07:38:31 -> cancelled 08:07:32 (30m18s)  (re-run)
 *   PR #5294 job 95988703670  07:17:27 -> cancelled 07:46:21 (30m17s)
 *
 * The apt call was not in the workflow — it is what `playwright install-deps`
 * shells out to. Nothing bounded it, so a mirror that accepts the connection
 * and then never finishes the transfer consumed the entire job and left the
 * check `cancelled`: a gate that reports NOTHING, which is the worst of the
 * three possible outcomes.
 *
 * `scripts/ensure-chromium-ready.sh` replaces the unconditional apt call with
 * "prove the browser launches; reach for apt only if it does not, and bound it
 * when you do". The four cases below are the whole contract, and the third is
 * the direct regression pin: with apt stubbed to hang forever, the script must
 * still terminate.
 *
 * These run without a browser and without a network — both the launch probe and
 * the dependency install are substituted through the documented env seams. That
 * is deliberate: GitHub Actions cannot be run locally, so the logic that has to
 * survive a stalled mirror is pinned here, where it CAN be measured, rather
 * than only in a workflow nobody can execute outside CI.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const script = path.join(repoRoot, 'scripts/ensure-chromium-ready.sh');

interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
  elapsedMs: number;
}

function run(env: Record<string, string>): RunResult {
  const startedAt = Date.now();
  const result = spawnSync('bash', [script], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    elapsedMs: Date.now() - startedAt,
  };
}

/** A fresh marker path that no test shares with another. */
function marker(name: string): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), `os-5304-${name}-`)), 'deps-ran');
}

describe('ensure-chromium-ready.sh — apt is off the happy path', () => {
  it('never invokes the dependency install when Chromium already launches', () => {
    const ran = marker('happy');

    const result = run({
      OS_CHROMIUM_PROBE_CMD: 'true',
      OS_CHROMIUM_DEPS_CMD: `touch ${ran}`,
    });

    expect(result.status, result.stderr).toBe(0);
    expect(
      fs.existsSync(ran),
      'The dependency install ran even though Chromium launched. That is the objectui#5304 ' +
        'exposure back again: an unconditional apt-get on the critical path of the gate.',
    ).toBe(false);
    expect(result.stdout).toMatch(/No apt-get on this path/);
  });
});

describe('ensure-chromium-ready.sh — recovery when a library really is missing', () => {
  it('installs the system libraries and succeeds once Chromium launches', () => {
    const ran = marker('recover');

    // The probe fails until the install has run, then succeeds — the shape of a
    // runner image that genuinely lost a shared library.
    const result = run({
      OS_CHROMIUM_PROBE_CMD: `test -f ${ran}`,
      OS_CHROMIUM_DEPS_CMD: `touch ${ran}`,
    });

    expect(result.status, result.stderr).toBe(0);
    expect(fs.existsSync(ran)).toBe(true);
    expect(result.stdout).toMatch(/Chromium launches after installing its system libraries/);
  });
});

describe('ensure-chromium-ready.sh — a hanging apt cannot hang the job (the #5304 pin)', () => {
  it('terminates well inside the job ceiling when the dependency install never returns', () => {
    const result = run({
      OS_CHROMIUM_PROBE_CMD: 'false',
      // Stands in for `apt-get update` against the stalled mirror: it accepts
      // the call and never comes back.
      OS_CHROMIUM_DEPS_CMD: 'sleep 600',
      OS_CHROMIUM_DEPS_TIMEOUT: '2',
    });

    // The defect was unbounded waiting, so the assertion is on the clock. 600s
    // is what the stub would take unbounded; the real incident took 1_800s.
    expect(
      result.elapsedMs,
      `The script ran for ${result.elapsedMs}ms against a dependency install that never ` +
        'returns. Unbounded again — this is exactly what cancelled three jobs in objectui#5304.',
    ).toBeLessThan(60_000);
    expect(result.status, 'a browser that never became usable must still fail the job').not.toBe(0);
    expect(result.stderr).toMatch(/objectui#5304 signature/);
  }, 120_000);
});

describe('ensure-chromium-ready.sh — the gate still reports', () => {
  it('fails the job when Chromium cannot launch even after the install', () => {
    const result = run({
      OS_CHROMIUM_PROBE_CMD: 'false',
      OS_CHROMIUM_DEPS_CMD: 'true',
    });

    expect(
      result.status,
      'Exiting 0 with no usable browser would let the E2E suite report on a browser it never ' +
        'had. The point of #5304 is to RESTORE the signal, so this path must be red.',
    ).toBe(1);
    expect(result.stderr).toMatch(/must not report green/);
  });
});

describe('the workflows actually use it', () => {
  const workflows = ['.github/workflows/ci.yml', '.github/workflows/live-e2e.yml'];

  /**
   * Whole-line comments removed. Required, not cosmetic: both workflows now
   * explain the incident in prose and name the very spellings asserted against
   * below, so a scan that counted the prose would report an unbounded apt call
   * that no step makes.
   */
  const withoutComments = (yaml: string): string =>
    yaml
      .split('\n')
      .filter((line) => !/^\s*#/.test(line))
      .join('\n');

  it.each(workflows)('%s calls the script instead of shelling straight to apt', (file) => {
    const yaml = withoutComments(fs.readFileSync(path.join(repoRoot, file), 'utf8'));

    expect(
      yaml,
      `${file} must drive Chromium provisioning through scripts/ensure-chromium-ready.sh — ` +
        'that is the only place the apt call is bounded.',
    ).toMatch(/ensure-chromium-ready\.sh/);

    // The two spellings that reintroduce the unbounded `apt-get update`.
    // `playwright install chromium` (no `--with-deps`) is deliberately still
    // allowed and is what the cache-miss step runs: it downloads browser
    // binaries from Playwright's CDN and touches no apt mirror.
    expect(
      yaml,
      `${file} reintroduces an unbounded apt-get: 'playwright install --with-deps' and ` +
        "'playwright install-deps' both run 'apt-get update' with no timeout, which is the " +
        'objectui#5304 defect. Let scripts/ensure-chromium-ready.sh decide, and bound, that call.',
    ).not.toMatch(/playwright\s+install(-deps|\s+--with-deps)/);
  });
});
