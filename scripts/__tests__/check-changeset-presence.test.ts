import { afterAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { changedFiles, describeDeclaration, discoverPackages, readReleaseConfig, resolveBaseRef } from '../check-changeset-presence.mjs';

/**
 * objectui#3387 — a change to published source could ship with no changeset, and
 * nothing said so.
 *
 * objectstack#4731 / #4843 made the DECLARED changesets the single criterion for
 * which frontend changes shipped: the platform reads this repository's
 * `.changeset/*.md` into its own release notes. The premise underneath —
 * *published source changed ⇒ a changeset was written* — was enforced by nothing,
 * and three measured instances rode releases out anonymously (`19716b5bf`
 * fix(charts), `5e7ef1141` fix(i18n), `0e50440` #3518).
 *
 * What this file pins, in the order the gate can fail:
 *
 *  1. **The workflow is reachable at all.** A gate behind a path filter it cannot
 *     start is the shape objectui#3523 spent a P0 on, and this gate's own subject
 *     matter makes it acute: `changeset-guard.yml` is invisible to a PR that
 *     forgot its changeset precisely because it filters on `.changeset/**`.
 *  2. **The guarded surface is DERIVED**, not a hand-written glob. The issue
 *     proposed one glob under `packages/`; `@object-ui/console` lives at
 *     `apps/console` and would have been missed — the most-edited published
 *     package in the repository, and the one the platform bump script writes a
 *     changeset for.
 *  3. **The verdicts**, against throwaway repositories rather than this one's
 *     history, so they stay decidable when the history moves.
 *  4. **Every missing input fails LOUD.** A diff gate that cannot compute its
 *     diff and exits 0 reports "declared" while having looked at nothing
 *     (objectstack#4928, objectui#4690).
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const GATE = 'scripts/check-changeset-presence.mjs';
const WORKFLOW = '.github/workflows/changeset-presence.yml';
const workflowDir = path.join(repoRoot, '.github/workflows');

/**
 * A workflow's YAML with whole-line comments removed.
 *
 * Required, not cosmetic: this workflow's header discusses `paths`,
 * `paths-ignore` and `push` at length — a scan that counted the prose would
 * report filters and triggers the file does not have. Same helper, same reason,
 * as in `docs-links-workflow.test.ts` and `merge-queue-reporting.test.ts`.
 */
function withoutComments(yaml: string): string {
  return yaml
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
}

const workflowYaml = withoutComments(fs.readFileSync(path.join(repoRoot, WORKFLOW), 'utf8'));

// ── fixture repositories ─────────────────────────────────────────────────────

const fixtures: string[] = [];
afterAll(() => {
  for (const dir of fixtures) fs.rmSync(dir, { recursive: true, force: true });
});

interface Fixture {
  root: string;
  git: (...args: string[]) => string;
  write: (rel: string, body: string) => void;
  commit: (message: string) => string;
}

/**
 * A throwaway repository shaped like this one: a `fixed` group, an `ignore`d
 * package, packages under BOTH `packages/` and `apps/`.
 *
 * Named `@fixture/*` on purpose — if the gate ever stopped reading
 * `.changeset/config.json` and fell back to a hard-coded `@object-ui/*` surface,
 * every verdict below would flip, which is the drift these fixtures exist to
 * catch.
 */
function fixtureRepo(label: string, { classifyAll = true } = {}): Fixture {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `changeset-presence-${label}-`));
  fixtures.push(root);

  const git = (...args: string[]): string =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

  const write = (rel: string, body: string): void => {
    fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  };

  const commit = (message: string): string => {
    execFileSync('git', ['add', '-A', '-f'], { cwd: root });
    execFileSync('git', ['commit', '-q', '-m', message], { cwd: root });
    return git('rev-parse', 'HEAD');
  };

  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'fixture@example.com');
  git('config', 'user.name', 'Fixture');

  write(
    '.changeset/config.json',
    JSON.stringify({ fixed: [['@fixture/alpha', '@fixture/console']], ignore: ['@fixture/ignored-*'] }, null, 2),
  );
  write('.changeset/README.md', '# Changesets\n\nDocumentation, not a declaration.\n');
  write('packages/alpha/package.json', JSON.stringify({ name: '@fixture/alpha', version: '1.0.0' }));
  write('packages/alpha/src/index.ts', 'export const alpha = 1;\n');
  write('packages/alpha/README.md', 'alpha\n');
  write('packages/ignored-demo/package.json', JSON.stringify({ name: '@fixture/ignored-demo', version: '1.0.0' }));
  write('packages/ignored-demo/src/index.ts', 'export const demo = 1;\n');
  write('apps/console/package.json', JSON.stringify({ name: '@fixture/console', version: '1.0.0' }));
  write('apps/console/src/main.ts', 'export const main = 1;\n');
  write('docs/guide.md', 'guide\n');
  if (!classifyAll) {
    // A package in NEITHER the fixed group nor `ignore` — the case the gate
    // refuses to guess about.
    write('packages/newcomer/package.json', JSON.stringify({ name: '@fixture/newcomer', version: '1.0.0' }));
    write('packages/newcomer/src/index.ts', 'export const newcomer = 1;\n');
  }
  commit('base');

  return { root, git, write, commit };
}

interface Run {
  status: number;
  output: string;
}

/** Runs the real gate against a fixture, capturing status and both streams. */
function runGate(root: string, args: string[] = []): Run {
  try {
    const stdout = execFileSync('node', [path.join(repoRoot, GATE), '--root', root, ...args], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, output: stdout };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { status: failure.status ?? -1, output: `${failure.stdout ?? ''}${failure.stderr ?? ''}` };
  }
}

/** base..head for a fixture's last commit. */
function lastCommitRange(fixture: Fixture): string[] {
  return ['--base', fixture.git('rev-parse', 'HEAD~1'), '--head', fixture.git('rev-parse', 'HEAD')];
}

// ── 1. the workflow is reachable ─────────────────────────────────────────────

describe('changeset-presence.yml — the gate can start on the PR that needs it', () => {
  it('exists, and runs the gate script', () => {
    expect(fs.existsSync(path.join(repoRoot, WORKFLOW)), 'a check nothing runs is not a gate').toBe(true);
    expect(fs.existsSync(path.join(repoRoot, GATE)), `${GATE} must exist for the workflow to run it`).toBe(true);
    expect(workflowYaml).toMatch(new RegExp(`run:\\s*node\\s+${GATE.replace(/[.]/g, '\\.')}`));
  });

  it('carries NO path filter of any kind', () => {
    // The reason it is its own workflow AND unfiltered. A filter on the trigger
    // skips the whole workflow (GitHub has no per-job path filter), so the
    // context is never CREATED on a PR that does not match — and a required
    // context that is never created leaves the PR pending rather than failing
    // it, which in the queue means the ruleset's 60-minute timeout
    // (objectui#3523, #3509). It would also be a second copy of the script's
    // guarded surface, free to drift from the `.changeset/config.json` the
    // script derives it from.
    expect(workflowYaml).not.toMatch(/paths-ignore:/);
    expect(workflowYaml).not.toMatch(/^\s+paths:/m);
  });

  it('reports on pull requests and on merge-queue builds', () => {
    expect(workflowYaml).toMatch(/^\s*pull_request:/m);
    expect(
      workflowYaml,
      'A gate with no path filter reports on every PR and can therefore be REQUIRED. A required ' +
        'context that does not report on a queue build does not fail the queue, it stalls it until ' +
        "the ruleset's 60-minute status-check timeout (objectui#3523).",
    ).toMatch(/^\s*merge_group:/m);
  });

  it('does not run on push to main, where nothing can be declared any more', () => {
    // Not tidiness: the change has already landed, so a red push paints `main`
    // red at whoever committed next, and no declaration can still be written
    // into that change. The PR and the queue build are the two moments it can.
    expect(workflowYaml).not.toMatch(/^\s*push:/m);
  });

  it('checks out enough history for a merge base to exist', () => {
    // `fetch-depth: 0`. The default depth-1 clone gives `git merge-base` nothing
    // to find, and the script treats an unresolvable base as a hard failure — so
    // omitting this is a red build, not a silent pass. Pinned so it stays that
    // way rather than being "fixed" by making the script skip.
    expect(workflowYaml).toMatch(/fetch-depth:\s*0/);
  });

  it('is the only workflow that runs this gate, and needs no install to do it', () => {
    const runners = fs
      .readdirSync(workflowDir)
      .filter((file) => file.endsWith('.yml'))
      .filter((file) => withoutComments(fs.readFileSync(path.join(workflowDir, file), 'utf8')).includes(GATE));
    expect(runners).toEqual(['changeset-presence.yml']);
    expect(
      workflowYaml,
      'This gate reads `.changeset/config.json` and `git diff` only. A `pnpm install` here would ' +
        'turn a few-second check into a full install on every pull request.',
    ).not.toMatch(/pnpm install/);
  });

  it('leaves changeset-guard.yml alone — the two gates face opposite directions', () => {
    // `changeset-guard.yml`'s `paths: ['.changeset/**']` is deliberate: on a PR
    // that adds ONLY a changeset, every gate inside `ci.yml` and `lint.yml`
    // skips, so nothing in either of them ever reads the changeset — and that
    // guard exists to see exactly that PR. A PR that FORGOT its changeset does
    // not touch `.changeset/**`, so widening those paths would have broken the
    // case it was built for while still not catching this one. Two workflows,
    // one direction each.
    //
    // Not the reason this comment used to give — "a PR adding ONLY a changeset
    // starts no other workflow". That is the sentence PR #4371 rewrote in the
    // docblock of `check-changeset-presence.mjs`, the script this file
    // accompanies, and the pair disagreed across the two until objectui#4381.
    // objectui#3523 step 2 deleted `paths-ignore` from `ci.yml`'s and
    // `lint.yml`'s `pull_request` trigger; it survives only on `push`. Such a PR
    // therefore DOES start both and DOES produce their contexts — measured: PR
    // #3856 (one markdown file) 16 checks, PR #4339 (one line added to
    // AGENTS.md) 17. What still skips is the expensive work: the `Decide whether
    // this change needs a full run` step excludes markdown and `.changeset/**`
    // and skips every step below itself, and its exclusion list is that `push`
    // filter unchanged, held identical to it by
    // `scripts/__tests__/merge-queue-reporting.test.ts`. The conclusion outlived
    // its premise; objectui#3857 pinned the correction.
    const guard = withoutComments(fs.readFileSync(path.join(workflowDir, 'changeset-guard.yml'), 'utf8'));
    expect(guard).toMatch(/^\s+paths:/m);
    expect(guard).toMatch(/\.changeset\//);
    expect(guard).toMatch(/check-changeset-no-major\.mjs/);
  });
});

// ── 2. the guarded surface is derived from the release configuration ─────────

describe('the guarded surface follows .changeset/config.json, not a hand-written glob', () => {
  it('guards apps/console — the package a `packages/*` glob would have missed', () => {
    // objectui#3387 proposed the surface as one glob under `packages/`.
    // `@object-ui/console` is published, is the most-edited package here, and is
    // the one the platform's `bump-objectui.sh` writes a changeset FOR — and it
    // lives outside that glob. This assertion is the reason the surface is read
    // from the release configuration instead.
    const config = readReleaseConfig(repoRoot);
    const packages = discoverPackages(repoRoot, config);

    const console_ = packages.get('apps/console');
    expect(console_?.name).toBe('@object-ui/console');
    expect(console_?.versioned, '@object-ui/console is in the fixed group, so the release covers it').toBe(true);

    expect(packages.get('packages/plugin-charts')?.versioned).toBe(true);
    expect(packages.get('packages/i18n')?.versioned).toBe(true);
  });

  it('does not guard what changesets ignores', () => {
    const config = readReleaseConfig(repoRoot);
    const packages = discoverPackages(repoRoot, config);
    const site = packages.get('apps/site');
    expect(site?.name).toBe('@object-ui/site');
    expect(site?.versioned, '@object-ui/site is in `ignore` — no release covers it').toBe(false);
    expect(site?.ignored).toBe(true);
  });

  it('would guard nothing only if the release configuration said so — and refuses to', () => {
    // The empty-surface trap: a gate whose surface collapses to zero passes
    // everything while looking healthy. `readReleaseConfig` rejects an empty
    // `fixed` group rather than guarding nothing.
    const empty = fixtureRepo('empty-fixed');
    empty.write('.changeset/config.json', JSON.stringify({ fixed: [], ignore: [] }));
    empty.commit('empty fixed group');
    const run = runGate(empty.root, lastCommitRange(empty));
    expect(run.status).toBe(1);
    expect(run.output).toMatch(/empty `fixed` group/);
  });
});

// ── 3. the verdicts ──────────────────────────────────────────────────────────

describe('a change to guarded source must declare a changeset', () => {
  it('FAILS when guarded source changes with no changeset', () => {
    const repo = fixtureRepo('missing');
    repo.write('packages/alpha/src/index.ts', 'export const alpha = 2;\n');
    repo.commit('fix(alpha): a user-visible fix nobody declared');

    const run = runGate(repo.root, lastCommitRange(repo));
    expect(run.status).toBe(1);
    expect(run.output).toMatch(/adds no changeset/);
    expect(run.output).toMatch(/@fixture\/alpha/);
    expect(run.output).toMatch(/packages\/alpha\/src\/index\.ts/);
    // The remedy has to include the exemption, or the gate reads as "you must
    // release something", which is not what it asks for.
    expect(run.output).toMatch(/pnpm changeset/);
    expect(run.output).toMatch(/EMPTY frontmatter/);
  });

  it('FAILS the same way for apps/console source', () => {
    const repo = fixtureRepo('console');
    repo.write('apps/console/src/main.ts', 'export const main = 2;\n');
    repo.commit('fix(console): undeclared');

    const run = runGate(repo.root, lastCommitRange(repo));
    expect(run.status).toBe(1);
    expect(run.output).toMatch(/@fixture\/console/);
  });

  it('PASSES when the change declares a changeset', () => {
    const repo = fixtureRepo('declared');
    repo.write('packages/alpha/src/index.ts', 'export const alpha = 2;\n');
    repo.write('.changeset/brave-pandas-sing.md', '---\n"@fixture/alpha": patch\n---\n\nFix the alpha.\n');
    repo.commit('fix(alpha): declared');

    const run = runGate(repo.root, lastCommitRange(repo));
    expect(run.status).toBe(0);
    expect(run.output).toMatch(/declares 1 changeset/);
  });

  it('PASSES on an EMPTY frontmatter — the explicit release-nothing exemption', () => {
    // The whole point of objectui#3387's wording: what is demanded is a
    // declaration, once, not a release. A gate that refused this would push
    // authors to invent a patch bump for a test-only change, which is worse than
    // the silence it replaced.
    const repo = fixtureRepo('exempt');
    repo.write('packages/alpha/src/__tests__/alpha.test.ts', 'it("works", () => {});\n');
    repo.write('.changeset/no-release.md', '---\n---\n\nTest-only change; no published behaviour changes.\n');
    repo.commit('test(alpha): exempt');

    const run = runGate(repo.root, lastCommitRange(repo));
    expect(run.status).toBe(0);
    expect(run.output).toMatch(/EMPTY frontmatter/);
    expect(run.output).toMatch(/explicit exemption/);
  });

  it('PASSES when nothing guarded changed', () => {
    const repo = fixtureRepo('unguarded');
    repo.write('docs/guide.md', 'guide, revised\n');
    repo.write('packages/alpha/README.md', 'alpha, revised\n');
    repo.write('packages/ignored-demo/src/index.ts', 'export const demo = 2;\n');
    repo.commit('docs: no released source touched');

    const run = runGate(repo.root, lastCommitRange(repo));
    expect(run.status).toBe(0);
    expect(run.output).toMatch(/no changeset is owed/);
    // The ignored package's source changed and was deliberately not counted.
    expect(run.output).toMatch(/1 file\(s\) under a package changesets ignores/);
  });

  it('does not accept a changeset that was already pending — it must be ADDED here', () => {
    // `.changeset/` accumulates until a release, so "a changeset exists in the
    // tree" is satisfied by somebody else's declaration and would make this gate
    // vacuous for every change that follows one.
    //
    // What this pins is the RANGE (a two-commit diff, not a scan of the tree). It
    // is deliberately NOT the assertion that covers `--diff-filter=A`: measured by
    // deleting that filter, this test stays green, because a changeset added in an
    // earlier commit is already outside the diff. The two tests below are the ones
    // that reach the filter, and they were written after that measurement — the
    // first draft claimed this one covered it, which would have left a fixture
    // passing for a weaker reason than its comment said.
    const repo = fixtureRepo('pending');
    repo.write('.changeset/someone-elses.md', '---\n"@fixture/alpha": patch\n---\n\nAn earlier change.\n');
    repo.commit('feat(alpha): an earlier, declared change');
    repo.write('packages/alpha/src/index.ts', 'export const alpha = 3;\n');
    repo.commit('fix(alpha): undeclared, riding on the pending changeset');

    const run = runGate(repo.root, lastCommitRange(repo));
    expect(run.status).toBe(1);
    expect(run.output).toMatch(/adds no changeset/);
  });

  it('does not accept EDITING a pre-existing changeset as declaring this change', () => {
    // Reaches `--diff-filter=A`: an edit to somebody else's pending declaration is
    // a `M` in the diff, so without the filter it would satisfy this gate —
    // measured, by removing the filter and watching this go green. Touching a
    // changeset is not writing one.
    const repo = fixtureRepo('edits-pending');
    repo.write('.changeset/someone-elses.md', '---\n"@fixture/alpha": patch\n---\n\nAn earlier change.\n');
    repo.commit('feat(alpha): an earlier, declared change');

    repo.write('packages/alpha/src/index.ts', 'export const alpha = 10;\n');
    repo.write('.changeset/someone-elses.md', '---\n"@fixture/alpha": patch\n---\n\nAn earlier change, reworded.\n');
    repo.commit('fix(alpha): undeclared, but it did touch a changeset');

    const run = runGate(repo.root, lastCommitRange(repo));
    expect(run.status).toBe(1);
    expect(run.output).toMatch(/adds no changeset/);
  });

  it('does not accept DELETING a pre-existing changeset as declaring this change', () => {
    // The same filter from the other side: a `D` is a touched `.changeset/*.md`
    // too, so removing a pending declaration while editing source must not pass.
    //
    // Measured, and NOT the same story as the edit case above: with
    // `--diff-filter=A` deleted this test stays GREEN, because a deleted file
    // cannot be read at `head`, so it parses as declaring nothing and is rejected
    // by the second mechanism instead. Two independent defences, and this test
    // pins the OUTCOME rather than either one of them — worth keeping precisely
    // because whichever defence is removed first, the other still holds the line.
    const repo = fixtureRepo('deletes-pending');
    repo.write('.changeset/someone-elses.md', '---\n"@fixture/alpha": patch\n---\n\nAn earlier change.\n');
    repo.commit('feat(alpha): an earlier, declared change');

    repo.write('packages/alpha/src/index.ts', 'export const alpha = 11;\n');
    fs.rmSync(path.join(repo.root, '.changeset/someone-elses.md'));
    repo.commit('fix(alpha): undeclared, and it dropped the pending changeset');

    const run = runGate(repo.root, lastCommitRange(repo));
    expect(run.status).toBe(1);
    expect(run.output).toMatch(/adds no changeset/);
  });

  it('does not accept .changeset/README.md as a declaration', () => {
    const repo = fixtureRepo('readme');
    fs.rmSync(path.join(repo.root, '.changeset/README.md'));
    repo.commit('chore: drop the changeset README');
    repo.write('packages/alpha/src/index.ts', 'export const alpha = 4;\n');
    repo.write('.changeset/README.md', '# Changesets\n\nRe-added documentation.\n');
    repo.commit('fix(alpha): with only the README back');

    const run = runGate(repo.root, lastCommitRange(repo));
    expect(run.status).toBe(1);
  });

  it('does not accept an added .changeset file with no frontmatter block', () => {
    // It declares nothing, and changesets reads nothing out of it. Reported as
    // ignored rather than accepted, so a gate satisfied by an empty gesture
    // cannot be mistaken for one satisfied by a declaration.
    const repo = fixtureRepo('no-frontmatter');
    repo.write('packages/alpha/src/index.ts', 'export const alpha = 5;\n');
    repo.write('.changeset/notes.md', 'Some notes with no frontmatter at all.\n');
    repo.commit('fix(alpha): with a note instead of a changeset');

    const run = runGate(repo.root, lastCommitRange(repo));
    expect(run.status).toBe(1);
    expect(run.output).toMatch(/no `---` frontmatter block/);
  });

  it('counts an UNTRACKED changeset when judging the working tree', () => {
    // `pnpm changeset` leaves a brand-new, unstaged file, and `git diff` cannot
    // see one. Without this, running the gate locally right after writing a
    // changeset reports it missing — a false red that teaches the author the
    // gate is broken.
    const repo = fixtureRepo('untracked');
    repo.write('packages/alpha/src/index.ts', 'export const alpha = 6;\n');
    repo.commit('fix(alpha): source only, so far');
    const base = repo.git('rev-parse', 'HEAD~1');

    const before = runGate(repo.root, ['--base', base]);
    expect(before.status, 'working tree, no changeset yet').toBe(1);

    repo.write('.changeset/fresh-from-pnpm-changeset.md', '---\n"@fixture/alpha": patch\n---\n\nFix it.\n');
    const after = runGate(repo.root, ['--base', base]);
    expect(after.status, 'the untracked changeset counts against the working tree').toBe(0);
    expect(after.output).toMatch(/fresh-from-pnpm-changeset\.md/);
  });
});

// ── 4. every missing input fails loud ───────────────────────────────────────

describe('a missing input is a failure, never a silent pass', () => {
  it('FAILS on an explicitly named base that does not exist — it does NOT fall back', () => {
    // The direction is the whole point, and it is the OPPOSITE of a filter gate's
    // (objectstack#4928): `ci.yml`'s gates decide whether to RUN work, so "cannot
    // tell" means run. Here the work IS the decision, so "cannot tell" means
    // fail. Both refuse to report green having looked at nothing.
    //
    // This assertion found a real defect in the first draft. `resolveBaseRef`
    // treated `--base` as merely the FIRST candidate in a chain, so an explicit
    // sha that was missing from the clone fell through to `merge-base with main`
    // — the gate then compared the change against a completely different commit
    // and printed a confident green (measured: exit 0). "The base you named is
    // missing" and "you named no base" are different facts; only the second may
    // be answered by guessing.
    const repo = fixtureRepo('no-base');
    repo.write('packages/alpha/src/index.ts', 'export const alpha = 9;\n');
    repo.commit('fix(alpha): undeclared, and judged against a base that does not exist');

    const run = runGate(repo.root, ['--base', '0123456789abcdef0123456789abcdef01234567']);
    expect(run.status).toBe(1);
    expect(run.output).toMatch(/Cannot resolve the commit to compare against/);
    expect(run.output).toMatch(/named EXPLICITLY/);
    expect(run.output).toMatch(/failure, not a skip/);
    // And specifically NOT the pass it used to produce by comparing against main.
    expect(run.output).not.toMatch(/no changeset is owed/);
  });

  it('names the shallow-clone case, which is how CI hits it', () => {
    const repo = fixtureRepo('shallow-source');
    repo.write('packages/alpha/src/index.ts', 'export const alpha = 7;\n');
    repo.commit('fix(alpha): second commit');

    const shallow = fs.mkdtempSync(path.join(os.tmpdir(), 'changeset-presence-shallow-'));
    fixtures.push(shallow);
    execFileSync('git', ['clone', '-q', '--depth', '1', `file://${repo.root}`, shallow], { stdio: ['ignore', 'pipe', 'pipe'] });
    // What a depth-1 CI checkout of a pull-request merge ref actually looks like:
    // a detached HEAD, no local `main`, and no `origin/main` — so there is no ref
    // any merge base can be computed against. (HEAD is detached FIRST; git
    // refuses to delete the branch a worktree has checked out.)
    execFileSync('git', ['checkout', '-q', '--detach'], { cwd: shallow });
    execFileSync('git', ['branch', '-q', '-D', 'main'], { cwd: shallow, stdio: ['ignore', 'pipe', 'pipe'] });
    execFileSync('git', ['update-ref', '-d', 'refs/remotes/origin/main'], { cwd: shallow });

    const run = runGate(shallow);
    expect(run.status).toBe(1);
    expect(run.output).toMatch(/SHALLOW/);
    expect(run.output).toMatch(/fetch-depth: 0/);
  });

  it('FAILS when .changeset/ does not exist', () => {
    // Named explicitly by objectui#3387: losing the ability to tell what a
    // declaration would even be about must be a red build.
    const repo = fixtureRepo('no-changeset-dir');
    repo.write('packages/alpha/src/index.ts', 'export const alpha = 8;\n');
    repo.commit('fix(alpha): change');
    fs.rmSync(path.join(repo.root, '.changeset'), { recursive: true, force: true });

    const run = runGate(repo.root, ['--base', repo.git('rev-parse', 'HEAD~1')]);
    expect(run.status).toBe(1);
    expect(run.output).toMatch(/does not exist/);
    expect(run.output).toMatch(/cannot tell whether one is owed/);
  });

  it('FAILS when changed source belongs to a package the release configuration does not classify', () => {
    // The gate will not guess "not released" for a package nobody classified —
    // that would leave the NEWEST package in the repository the one nothing
    // guards. `check-changeset-fixed.mjs` owns the classification itself.
    const repo = fixtureRepo('unclassified', { classifyAll: false });
    repo.write('packages/newcomer/src/index.ts', 'export const newcomer = 2;\n');
    repo.commit('feat(newcomer): source change in an unclassified package');

    const run = runGate(repo.root, lastCommitRange(repo));
    expect(run.status).toBe(1);
    expect(run.output).toMatch(/@fixture\/newcomer/);
    expect(run.output).toMatch(/neither the `fixed` group nor `ignore`/);
    expect(run.output).toMatch(/check-changeset-fixed\.mjs/);
  });

  it('surfaces git\'s own explanation when a diff cannot be computed', () => {
    // `changedFiles` throws rather than returning an empty list. The two are
    // indistinguishable to a caller that swallows the error, and "no files
    // changed" is the reading that passes.
    const repo = fixtureRepo('diff-failure');
    expect(() => changedFiles(repo.root, { base: 'refs/heads/definitely-not-a-branch' })).toThrowError(/git diff/);
  });

  it('reports which candidates it tried when no base resolves', () => {
    const repo = fixtureRepo('tried');
    execFileSync('git', ['checkout', '-q', '-b', 'detached-from-main'], { cwd: repo.root });
    execFileSync('git', ['branch', '-q', '-D', 'main'], { cwd: repo.root });
    const outcome = resolveBaseRef(repo.root, { env: {} });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.tried.join(', ')).toMatch(/merge-base with origin\/main \(unresolved\)/);
      expect(outcome.tried.join(', ')).toMatch(/merge-base with main \(unresolved\)/);
    }
  });
});

// ── 5. the frontmatter reader ────────────────────────────────────────────────

describe('describeDeclaration — what counts as a declaration', () => {
  it('reads an empty frontmatter as a declaration of nothing', () => {
    expect(describeDeclaration('---\n---\n\nWhy this releases nothing.\n')).toEqual({ kind: 'frontmatter', entries: 0 });
  });

  it('counts package entries, quoted or bare', () => {
    expect(describeDeclaration('---\n"@fixture/alpha": patch\n@fixture/beta: minor\n---\n\nBody.\n')).toEqual({
      kind: 'frontmatter',
      entries: 2,
    });
  });

  it('ignores comments and blank lines inside the frontmatter', () => {
    expect(describeDeclaration('---\n# a comment\n\n"@fixture/alpha": patch\n---\n')).toEqual({
      kind: 'frontmatter',
      entries: 1,
    });
  });

  it('rejects a file with no frontmatter, and one whose frontmatter never closes', () => {
    expect(describeDeclaration('Just prose.\n').kind).toBe('none');
    expect(describeDeclaration('---\n"@fixture/alpha": patch\n\nBody with no closing delimiter.\n').kind).toBe('none');
  });
});
