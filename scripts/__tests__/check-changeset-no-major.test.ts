import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Plain-JS CI helper. Its types are INFERRED from the .mjs source by
// `tsconfig.scripts.json` (`allowJs`), so no `@ts-expect-error` here —
// re-adding one is now itself an error (TS2578). See objectui#3494.
import { findMajorBumps, parseFrontmatterBumps } from '../check-changeset-no-major.mjs';

/**
 * objectui's major is not a count of its own breaking changes — it is pinned to
 * the `@objectstack` major so that "same major ⇒ compatible" holds across the
 * two repos (AGENTS.md §版本号策略). Since every publishable package sits in one
 * `fixed` group, ONE `major` in ONE changeset publishes all 39 of them as the
 * next major and breaks that pin.
 *
 * Four pending changesets had scored `major` (17 package entries) during the
 * 17.x line, which would have shipped 39 packages as 18.0.0 against an
 * `@objectstack` still on 17. The rule was written down and nothing ran it:
 * back then `ci.yml` and `lint.yml` both carried `paths-ignore` on their
 * `pull_request` trigger with `.changeset/**` in it, so a changeset-only PR
 * started no workflow at all.
 *
 * That last sentence is history. objectui#3523 step 2 deleted `paths-ignore`
 * from those `pull_request` triggers — it survives only on `push` — so such a
 * PR does start both workflows and does produce their contexts today. What it
 * still does not do is run anything expensive in them: the `Decide whether this
 * change needs a full run` step excludes markdown and `.changeset/**` and skips
 * every step below itself. Either way no gate inside those workflows reads the
 * changeset, which is why the locks below still stand (objectui#3857).
 *
 * These tests are the second lock. `.github/workflows/changeset-guard.yml`
 * catches it on the PR that adds the changeset; the repo-state test below
 * catches it in `pnpm test` even if that workflow is ever removed or its
 * trigger stops matching.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const changesetDir = path.join(repoRoot, '.changeset');
const workflowDir = path.join(repoRoot, '.github/workflows');

describe('parseFrontmatterBumps', () => {
  it('reads the package/bump pairs out of the frontmatter block', () => {
    const source = [
      '---',
      '"@object-ui/layout": minor',
      "'@object-ui/fields': patch",
      '@object-ui/core: minor',
      '---',
      '',
      'Body text.',
    ].join('\n');

    expect(parseFrontmatterBumps(source)).toEqual([
      { pkg: '@object-ui/layout', bump: 'minor', line: 2 },
      { pkg: '@object-ui/fields', bump: 'patch', line: 3 },
      { pkg: '@object-ui/core', bump: 'minor', line: 4 },
    ]);
  });

  it('stops at the closing `---`, so prose about a bump is not a bump', () => {
    // Changeset bodies in this repo discuss the major/minor call explicitly —
    // and a body may hold a fenced YAML example. Neither may register as a
    // declaration, or the guard would fail on a changeset that is obeying it.
    const source = [
      '---',
      '"@object-ui/layout": minor',
      '---',
      '',
      'Scored `minor`, not `major`, per the fixed-group rule.',
      '',
      '```yaml',
      '"@object-ui/layout": major',
      '```',
    ].join('\n');

    expect(parseFrontmatterBumps(source)).toEqual([
      { pkg: '@object-ui/layout', bump: 'minor', line: 2 },
    ]);
    expect(findMajorBumps([{ file: 'x.md', source }])).toEqual([]);
  });

  it('returns nothing for a file with no frontmatter', () => {
    expect(parseFrontmatterBumps('# Just a readme\n')).toEqual([]);
  });
});

describe('findMajorBumps', () => {
  it('reports every major entry with a file:line to jump to', () => {
    const source = ['---', '"@object-ui/auth": major', '"@object-ui/react": minor', '---'].join(
      '\n'
    );

    expect(findMajorBumps([{ file: '.changeset/a.md', source }])).toEqual([
      { file: '.changeset/a.md', pkg: '@object-ui/auth', line: 2 },
    ]);
  });
});

describe('the repository itself', () => {
  it('has no pending changeset declaring a `major` bump', () => {
    const changesets = fs
      .readdirSync(changesetDir)
      .filter((name) => name.endsWith('.md') && name !== 'README.md')
      .map((name) => ({
        file: path.join('.changeset', name),
        source: fs.readFileSync(path.join(changesetDir, name), 'utf8'),
      }));

    const offenders = findMajorBumps(changesets) as { file: string; pkg: string; line: number }[];

    expect(
      offenders.map(({ file, pkg, line }) => `${pkg} at ${file}:${line}`),
      'A `major` publishes all 39 fixed-group packages as the next major, off the @objectstack ' +
        'major objectui is pinned to. Score it `minor` and describe the break in the body — ' +
        'see AGENTS.md §版本号策略.'
    ).toEqual([]);
  });
});

describe('changeset-guard.yml', () => {
  const guard = fs.readFileSync(path.join(workflowDir, 'changeset-guard.yml'), 'utf8');

  it('runs the guard script', () => {
    expect(guard).toContain('node scripts/check-changeset-no-major.mjs');
  });

  it('triggers on `.changeset/**` — the paths every other workflow ignores', () => {
    // The inverse pin, and the reason `ci.yml` still cannot host this check: on
    // a changeset-only PR its `Decide whether this change needs a full run` step
    // finds nothing outside its exclusion list (markdown and `.changeset/**`
    // among it) and skips every step below itself, so no gate in that workflow
    // ever reads the changeset. This one has to run outside that decision.
    //
    // Not the reason this comment used to give — "a changeset-only PR matches
    // its `paths-ignore` twice over, so no job in it would ever run". Since
    // objectui#3523 step 2, `paths-ignore` is gone from the `pull_request`
    // trigger and survives only on `push`: such a PR does start `ci.yml` and
    // does produce its contexts (measured — PR #3856, one markdown file, 16
    // checks; PR #4339, one line added to AGENTS.md, 17). The conclusion
    // outlived the premise; objectui#3857 pinned the correction.
    //
    // That surviving `push` copy is what the two assertions below read, and it
    // is why they stay green — `ci.yml` genuinely still declares `paths-ignore`
    // with markdown in it, on `push`. The in-job exclusion list is held
    // identical to that filter by `scripts/__tests__/merge-queue-reporting.test.ts`,
    // so the pair cannot drift apart silently.
    expect(guard).toMatch(/paths:\s*\n\s*- '\.changeset\/\*\*'/);

    const ci = fs.readFileSync(path.join(workflowDir, 'ci.yml'), 'utf8');
    expect(ci).toContain("paths-ignore:");
    expect(ci).toContain("- '**/*.md'");
  });
});
