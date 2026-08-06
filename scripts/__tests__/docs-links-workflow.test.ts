import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * objectui#3448 — the wiring test for `scripts/check-doc-links.mjs`.
 *
 * The script is older than its gate. It existed, worked, and nothing under
 * `.github/` called it, so it had never run in CI at all and `main` carried a
 * broken link it would have caught (#3213, #3292). PR #3450 fixed that by adding
 * it as a step in `ci.yml`'s `docs` job — and rebuilt half the hole in the
 * process: `ci.yml` lists every markdown path, plus `content/**`, `docs/**` and
 * `apps/site/**`, under `paths-ignore`; `paths-ignore` skips the *entire*
 * workflow when every changed file matches it, and GitHub has no per-job path
 * filter. A docs-only PR therefore started no workflow, so the one class of
 * change most likely to break an internal link was the one class the link check
 * could never see.
 *
 * `control-bytes.yml` hit this exact wall first and its header states the
 * consequence: a gate that cannot see a markdown-only PR "rebuilds the hole it
 * exists to close". `changeset-guard.yml` is the second instance. This is the
 * third, and the test below is what keeps it from regressing — the failure mode
 * is silent by construction, because a path-filtered gate looks green and
 * configured while simply never running.
 *
 * The last assertion pins the de-duplication decision, not just the shape: the
 * check has exactly ONE home. Re-adding a copy to a path-filtered workflow is
 * the specific mistake that would restore the illusion of coverage.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflowDir = path.join(repoRoot, '.github/workflows');
const workflowPath = path.join(workflowDir, 'docs-links.yml');
const SCRIPT = 'scripts/check-doc-links.mjs';

/**
 * A workflow's YAML with whole-line comments removed.
 *
 * Required, not cosmetic: `ci.yml` still *names* the script in the comment that
 * explains why the step was removed, and this workflow's own header discusses
 * `paths` / `paths-ignore` in prose. A scan that counted those would report a
 * duplicate gate and a path filter that neither file has.
 */
function withoutComments(yaml: string): string {
  return yaml
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
}

const workflowFiles = fs.readdirSync(workflowDir).filter((f) => f.endsWith('.yml'));

describe('docs-links.yml — the internal link gate is reachable', () => {
  it('exists at all', () => {
    expect(fs.existsSync(workflowPath), 'a check nothing runs is not a gate').toBe(true);
    expect(fs.existsSync(path.join(repoRoot, SCRIPT)), `${SCRIPT} must exist for the workflow to run it`).toBe(true);
  });

  it('runs the link checker', () => {
    expect(withoutComments(fs.readFileSync(workflowPath, 'utf8'))).toMatch(
      new RegExp(`run:\\s*node\\s+${SCRIPT.replace(/[.]/g, '\\.')}`),
    );
  });

  it('gates pull requests, not just pushes', () => {
    const yaml = withoutComments(fs.readFileSync(workflowPath, 'utf8'));
    expect(yaml).toMatch(/^\s*pull_request:/m);
    expect(yaml).toMatch(/^\s*push:/m);
  });

  it('carries NO path filter of any kind', () => {
    // The whole reason this is its own workflow. `paths-ignore` would recreate
    // #3448 verbatim; a `paths: content/**` filter would look tighter and buy
    // nothing — the run is a checkout plus one `node` call, and the filter would
    // be a second copy of the script's scan surface, free to drift from it.
    const yaml = withoutComments(fs.readFileSync(workflowPath, 'utf8'));
    expect(yaml).not.toMatch(/paths-ignore:/);
    expect(yaml).not.toMatch(/^\s+paths:/m);
  });

  it('is the only workflow that runs the link checker', () => {
    // Not tidiness: a second copy living in a path-filtered workflow is exactly
    // how a gate ends up looking covered while the docs-only PR still slips
    // past. One gate, one home — and one place to fix when it needs changing.
    const runners = workflowFiles.filter((f) =>
      withoutComments(fs.readFileSync(path.join(workflowDir, f), 'utf8')).includes(SCRIPT),
    );
    expect(runners).toEqual(['docs-links.yml']);
  });

  it('every workflow that runs it is one a docs-only PR can start', () => {
    // States the invariant rather than the file name, so it still holds if the
    // gate is ever moved or renamed: whoever runs this check must be startable
    // by a PR that touches nothing but markdown.
    expect(workflowFiles.length, 'the workflow directory scan returned implausibly few files').toBeGreaterThan(5);

    for (const file of workflowFiles) {
      const yaml = withoutComments(fs.readFileSync(path.join(workflowDir, file), 'utf8'));
      if (!yaml.includes(SCRIPT)) continue;
      expect(yaml, `${file} runs ${SCRIPT} behind a paths-ignore — a docs-only PR would not start it`).not.toMatch(
        /paths-ignore:/,
      );
      expect(yaml, `${file} runs ${SCRIPT} behind a paths filter — see objectui#3448`).not.toMatch(/^\s+paths:/m);
    }
  });

  it('is runnable locally under the name the docs give', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    expect(pkg.scripts['docs:check-links']).toBe(`node ${SCRIPT}`);
  });
});
