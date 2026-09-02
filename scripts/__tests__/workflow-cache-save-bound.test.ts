import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

/**
 * objectui#7048 — every cache save in this repository is bounded and non-fatal,
 * not just `ci.yml`'s `type-check` one.
 *
 * ## Why a second file beside `turbo-cache-save-bound.test.ts`
 *
 * That file is about ONE INCIDENT and one job: the 2026-08-26 merge-group build
 * of #6571, where all 21 real steps of `Type Check` passed and then the
 * runner-generated `Post Turbo Cache` spent 13m09s (789s) in the upload, hit the
 * job's `timeout-minutes: 20`, and turned an all-green pull request into a
 * `cancelled` check the merge queue could not tell from a failure. Its
 * assertions are sized against that job's numbers and it should stay that way.
 *
 * This file is about the POPULATION. When #6577's fix landed, seven more
 * combined `actions/cache@v6` uses across five workflows carried the identical
 * exposure — that was the repository's DEFAULT SPELLING for caching, not an edge
 * case on one job — and nothing in the tree noticed. So the subject here is the
 * rule rather than the site: enumerate every workflow file, and require of every
 * cache save what #6577 proved a cache save must have.
 *
 * ## The ordering, which is the whole point
 *
 * The verdict is recorded by the checking steps; everything after them is
 * bookkeeping, and bookkeeping must never discard an answer the gate already
 * produced. Combined `actions/cache` declares `main: dist/restore/index.js` plus
 * `post: dist/save/index.js`, so its save is a step the RUNNER generates at job
 * end and NO workflow syntax attaches `timeout-minutes` or `continue-on-error`
 * to it. Splitting into `actions/cache/restore` + a trailing
 * `actions/cache/save` is not a style preference — it is the only way those two
 * keys can exist at all, and it is the route `actions/cache`'s own `save-always`
 * deprecation text points at.
 *
 * ## Why it needs a pin: reverting is invisible
 *
 * Fold any split back into one `actions/cache` step and nothing goes red. The
 * cache still works, every run still passes, and the next transient upload stall
 * ejects the next green pull request — or, in the three jobs here that declare
 * no `timeout-minutes` at all, holds a required context open against GitHub's
 * 360-minute default. That is this repository's recurring "looks like
 * enforcement, isn't" class (objectui#3009, #3181, #3494).
 *
 * ## Deliberately NOT asserted
 *
 * - That the RESTORE halves are bounded. A restore stall fails BEFORE any
 *   verdict exists — a gate that did not run, which is honest — rather than a
 *   recorded verdict discarded, and bounding it would force a cold check under
 *   the same ceiling.
 * - Any specific bound. Each site's number is derived from that site's own
 *   measured healthy save and written into the workflow comment beside it;
 *   objectui#7048 fences copying one site's number to another. What is asserted
 *   is that a bound EXISTS and that it cannot crowd out the checking steps.
 */

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const WORKFLOW_DIR = path.join(ROOT, '.github/workflows');

interface Step {
  name?: string;
  uses?: string;
  run?: string;
  id?: string;
  if?: string;
  'timeout-minutes'?: number;
  'continue-on-error'?: boolean;
  with?: Record<string, string>;
}
interface Job {
  'timeout-minutes'?: number;
  steps?: Step[];
}

const workflowFiles = fs
  .readdirSync(WORKFLOW_DIR)
  .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
  .sort();

interface JobEntry {
  file: string;
  jobKey: string;
  job: Job;
  steps: Step[];
}

const allJobs: JobEntry[] = workflowFiles.flatMap((file) => {
  const parsed = parseYaml(fs.readFileSync(path.join(WORKFLOW_DIR, file), 'utf8')) as {
    jobs?: Record<string, Job>;
  };
  return Object.entries(parsed?.jobs ?? {}).map(([jobKey, job]) => ({
    file,
    jobKey,
    job,
    steps: job.steps ?? [],
  }));
});

const usesPrefix = (step: Step, prefix: string) => (step.uses ?? '').startsWith(prefix);
const where = (e: JobEntry, s: Step) => `${e.file} :: job \`${e.jobKey}\` :: step \`${s.name ?? '(unnamed)'}\``;

describe('every workflow cache save is bounded and non-fatal (objectui#7048)', () => {
  it('reads a plausible population — the scan below is not vacuous', () => {
    // The enumeration is the axis that failed when this card was first filed:
    // the population was inherited from one file's grep instead of derived
    // across the directory, and undercounted by more than 3x. A control that
    // only proves the PROBE works cannot catch that; this one is on the
    // population itself.
    expect(
      workflowFiles.length,
      `implausibly few workflow files found under ${WORKFLOW_DIR} — every assertion below would ` +
        'pass while reading nothing',
    ).toBeGreaterThan(20);
    expect(allJobs.length, 'implausibly few jobs parsed out of those workflow files').toBeGreaterThan(20);
  });

  it('caches through the split form only — never the combined action', () => {
    const offenders = allJobs.flatMap((e) =>
      e.steps.filter((s) => /^actions\/cache@/.test(s.uses ?? '')).map((s) => where(e, s)),
    );

    expect(
      offenders,
      'these steps use the COMBINED `actions/cache` action:\n' +
        offenders.map((o) => `  - ${o}`).join('\n') +
        '\n\nIts save runs as a runner-generated POST step, which cannot carry `timeout-minutes` ' +
        'or `continue-on-error` — so an upload stall runs the job into its ceiling and cancels a ' +
        'gate that had already passed (objectui#6577), or, in a job with no declared ceiling, ' +
        "holds it against GitHub's 360-minute default. Use `actions/cache/restore` plus a bounded, " +
        '`continue-on-error` `actions/cache/save` placed after the last command step.',
    ).toEqual([]);
  });

  it('actually caches something — the rule above is not passing on an empty set', () => {
    // Without this, deleting every cache step in the repository would make the
    // assertion above green. The rule is "saves are bounded", not "there are no
    // saves".
    const saves = allJobs.flatMap((e) => e.steps.filter((s) => usesPrefix(s, 'actions/cache/save@')));
    expect(
      saves.length,
      'no workflow in this repository saves a cache any more. If that is deliberate, this whole ' +
        'file is obsolete and should be deleted with the reason recorded — not left passing on an ' +
        'empty set.',
    ).toBeGreaterThan(5);
  });

  it('bounds every save, and lets none of them speak for the code', () => {
    const unbounded: string[] = [];
    const fatal: string[] = [];

    for (const e of allJobs) {
      for (const s of e.steps.filter((x) => usesPrefix(x, 'actions/cache/save@'))) {
        if (typeof s['timeout-minutes'] !== 'number') unbounded.push(where(e, s));
        if (s['continue-on-error'] !== true) fatal.push(where(e, s));
      }
    }

    expect(
      unbounded,
      'these cache saves declare no `timeout-minutes`:\n' +
        unbounded.map((o) => `  - ${o}`).join('\n') +
        '\n\nThe bound is the only thing standing between a stalled upload and the job ceiling, ' +
        'and the job ceiling reports `cancelled` — a gate that says nothing at all (objectui#6577). ' +
        "Derive the number from that site's own measured healthy save; do not copy another site's.",
    ).toEqual([]);

    expect(
      fatal,
      'these cache saves do not declare `continue-on-error: true`:\n' +
        fatal.map((o) => `  - ${o}`).join('\n') +
        '\n\nWithout it the bound only trades a `cancelled` gate for a red one. A cache that ' +
        'failed to upload costs the next run some time and says nothing whatsoever about the code ' +
        'under test, so it must not be allowed to speak for it.',
    ).toEqual([]);
  });

  it('runs every save AFTER its job’s last command step — bookkeeping follows the verdict', () => {
    const hoisted: string[] = [];

    for (const e of allJobs) {
      const lastCommand = e.steps.map((s) => s.run !== undefined).lastIndexOf(true);
      if (lastCommand === -1) continue; // no commands in this job: nothing to protect
      for (const s of e.steps.filter((x) => usesPrefix(x, 'actions/cache/save@'))) {
        if (e.steps.indexOf(s) < lastCommand) {
          hoisted.push(`${where(e, s)} (runs before \`${e.steps[lastCommand].name ?? '(unnamed)'}\`)`);
        }
      }
    }

    expect(
      hoisted,
      'these cache saves run BEFORE their job’s last command step:\n' +
        hoisted.map((o) => `  - ${o}`).join('\n') +
        '\n\nThe verdict is recorded by the command steps; everything after them is bookkeeping, ' +
        'and that ordering is what makes a save safe to bound and safe to lose. A save hoisted ' +
        'above a checking step is bookkeeping that can still delay, and be blamed for, an answer ' +
        'that has not been produced yet (objectui#6577).',
    ).toEqual([]);
  });

  it('still caches the same thing the combined step did', () => {
    const broken: string[] = [];

    for (const e of allJobs) {
      const restores = e.steps.filter((s) => usesPrefix(s, 'actions/cache/restore@'));
      for (const save of e.steps.filter((s) => usesPrefix(s, 'actions/cache/save@'))) {
        const restore = restores.find((r) => r.with?.path === save.with?.path);
        if (!restore) {
          broken.push(`${where(e, save)}: no \`actions/cache/restore\` in this job reads path \`${save.with?.path}\``);
          continue;
        }
        if (save.with?.key !== restore.with?.key) {
          broken.push(`${where(e, save)}: writes key \`${save.with?.key}\` but the restore asks for \`${restore.with?.key}\` — every run would miss`);
        }
        if (!restore.id) {
          broken.push(`${where(e, restore)}: needs an \`id\` so the save can read its \`cache-hit\` output`);
          continue;
        }
        const guard = `steps.${restore.id}.outputs.cache-hit != 'true'`;
        if (!(save.if ?? '').includes(guard)) {
          broken.push(`${where(e, save)}: must skip on an exact primary-key hit — \`${guard}\`. The combined action did this internally; after the split it is the workflow’s job, and without it every re-run re-uploads a cache that already exists.`);
        }
      }
    }

    expect(broken, 'the split has silently changed what gets cached:\n' + broken.map((o) => `  - ${o}`).join('\n')).toEqual([]);
  });

  it('never lets bookkeeping crowd out the checking steps under a declared ceiling', () => {
    // Generalises the type-check pin's invariant to jobs with more than one
    // cache: it is the SUM of a job's save bounds that competes with its
    // verdict path for the ceiling, not any single bound.
    const crowded: string[] = [];

    for (const e of allJobs) {
      const ceiling = e.job['timeout-minutes'];
      if (typeof ceiling !== 'number') continue;
      const bounds = e.steps
        .filter((s) => usesPrefix(s, 'actions/cache/save@'))
        .map((s) => s['timeout-minutes'] ?? 0);
      if (bounds.length === 0) continue;
      const total = bounds.reduce((a, b) => a + b, 0);
      if (total * 2 > ceiling) {
        crowded.push(
          `${e.file} :: job \`${e.jobKey}\`: cache saves may run for ${total} of the job's ${ceiling} minutes (bounds: ${bounds.join(' + ')})`,
        );
      }
    }

    expect(
      crowded,
      'bookkeeping can starve the verdict path of its ceiling here:\n' +
        crowded.map((o) => `  - ${o}`).join('\n') +
        '\n\nA bound that large can still cancel the job — which is the defect, not the fix.',
    ).toEqual([]);
  });

  it('does not raise the ceilings of the jobs this card bounded — the ruled-out non-fix', () => {
    // Ruled out on objectui#6577 and again on #7048: a larger ceiling buys a
    // longer hang and still ends in `cancelled`, and lifting a gate's ceiling
    // weakens the gate. Raising one for some UNRELATED reason is a decision
    // someone may need to make — make it deliberately, and move this pin in the
    // same commit, rather than discovering later that the fix was undone by it.
    const ceilings: Record<string, number> = {
      'ci.yml::e2e': 30,
      'ci.yml::docs': 15,
      'live-e2e.yml::live-e2e': 40,
    };

    for (const [key, max] of Object.entries(ceilings)) {
      const [file, jobKey] = key.split('::');
      const entry = allJobs.find((e) => e.file === file && e.jobKey === jobKey);
      expect(entry, `${file} must still define a \`${jobKey}:\` job`).toBeDefined();
      expect(
        entry!.job['timeout-minutes'],
        `the \`${jobKey}\` job ceiling in ${file} moved. Raising it does not fix a hung cache save — ` +
          'the hang just runs longer and the gate still reports `cancelled` (objectui#6577).',
      ).toBeLessThanOrEqual(max);
    }
  });
});
