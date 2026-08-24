import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

/**
 * The pin for the `lane` job's changeset mirror in
 * `.github/workflows/changeset-release.yml` (objectui#5775).
 *
 * ## What the mirror is, and why a comment was not enough
 *
 * That job's `Detect pending changesets` step re-implements, in bash and before
 * any install, the file scan that `changesets/action` performs through
 * `readChangesetState`. Its output gates the release job's clear step, which is
 * the only thing standing between a release-merge commit and objectui#5442's
 * silent lost release. The step therefore carried a written declaration of what
 * the reader counts — and a written declaration is exactly the kind of claim
 * that is true on the day it is written and unfalsifiable afterwards. It drifted:
 * it named `README.md` as the whole exclusion list, compared that one spelling
 * exactly, and never looked at `.changeset/pre/`.
 *
 * ## The measurement this file locks (2026-08-24)
 *
 * There is no single "the reader". There are two copies, at different majors:
 *
 *   A. `changesets/action@v1` is v1.9.0 and BUNDLES `@changesets/read@^0.6.7`.
 *      Its shipped `dist/` chunk filters
 *      `!f.startsWith('.') && f.endsWith('.md') && !/^README\.md$/i.test(f)`
 *      over `.changeset/` only. No `AGENTS.md`, no `.changeset/pre/`.
 *   B. This repository INSTALLS `@changesets/read@1.0.0`, via the declared
 *      `@changesets/cli@3.0.1`. It adds the exact names `AGENTS.md`,
 *      `CLAUDE.md`, `GEMINI.md` to the ignore list and additionally reads
 *      `.changeset/pre/*.md`, giving those files ids like `pre/probe`.
 *
 * The two disagree in OPPOSITE directions, so "match the reader" has no single
 * answer and matching B alone would be a regression: `.changeset/AGENTS.md` is
 * invisible to B and PENDING to A, so a mirror that ignored it would skip the
 * clear step while the action still saw a changeset. The mirror therefore counts
 * the UNION, and the assertions below are split accordingly — the cases where it
 * must AGREE with the installed reader, and the three cases where it must
 * deliberately OVER-count it.
 *
 * ## Why this reads the installed dependency instead of a constant
 *
 * A pin transcribed from the same source as the code it guards drifts in
 * lockstep with it. So nothing here spells out what the reader ignores: the
 * reader is imported and executed over fixtures, and the mirror is EXTRACTED
 * from the workflow file rather than copied. A `@changesets/read` bump that
 * changes the ignore list changes these results and fails here.
 *
 * ⚠️ Resolution: `@changesets/read` is a transitive dependency and pnpm does not
 * hoist it, so it is NOT resolvable from the repo root — it has to be resolved
 * THROUGH `@changesets/cli`, the declared devDependency that owns it. Resolving
 * it any other way (a `.pnpm/` glob, a vendored copy) would answer about a file
 * the CLI never loads. It is ESM-only (`"type": "module"`, a single `exports`
 * target, one `dist/index.mjs` on disk), so there is no require-vs-import
 * divergence to pick the wrong half of.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// ── the installed reader, resolved through the package that owns it ──────────
const rootRequire = createRequire(path.join(repoRoot, 'noop.cjs'));
const cliManifestPath = rootRequire.resolve('@changesets/cli/package.json');
const fromCli = createRequire(cliManifestPath);
const readerManifestPath = fromCli.resolve('@changesets/read/package.json');
const readerManifest = JSON.parse(fs.readFileSync(readerManifestPath, 'utf8')) as {
  name: string;
  version: string;
};
const readerEntryPath = fromCli.resolve('@changesets/read');
const { readChangesets } = (await import(pathToFileURL(readerEntryPath).href)) as {
  readChangesets: (rootDir: string, sinceRef?: string) => Promise<{ id: string }[]>;
};

// ── the mirror, extracted from the workflow (never copied) ───────────────────
const workflowPath = path.join(repoRoot, '.github/workflows/changeset-release.yml');
const workflow = parseYaml(fs.readFileSync(workflowPath, 'utf8')) as {
  jobs: Record<string, { steps: { id?: string; name?: string; uses?: string; run?: string }[] }>;
};
const detectStep = workflow.jobs.lane.steps.find((step) => step.id === 'detect');
const mirrorScript = detectStep?.run ?? '';

/** A changeset the reader can parse. Its content is irrelevant to both scans. */
const CHANGESET = "---\n'@object-ui/core': patch\n---\n\nfixture\n";
/** The empty-frontmatter form this repository uses for "nothing to release". */
const EMPTY_CHANGESET = '---\n---\n\nfixture\n';

function makeFixture(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-mirror-'));
  fs.mkdirSync(path.join(dir, '.changeset'), { recursive: true });
  for (const [relative, body] of Object.entries(files)) {
    const full = path.join(dir, '.changeset', relative);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  return dir;
}

type MirrorResult = { pending: string | undefined; ids: string[] };

/**
 * Runs the workflow step's own script against a fixture, with the GitHub
 * runner's variables supplied. `set -u` is on in that script, so every variable
 * it reads has to be present or the run fails for the wrong reason.
 */
function runMirror(dir: string, script: string = mirrorScript): MirrorResult {
  const outputFile = path.join(dir, 'gh-output');
  const summaryFile = path.join(dir, 'gh-summary');
  fs.writeFileSync(outputFile, '');
  fs.writeFileSync(summaryFile, '');
  const stdout = execFileSync('bash', ['-c', script], {
    cwd: dir,
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_OUTPUT: outputFile,
      GITHUB_STEP_SUMMARY: summaryFile,
      GITHUB_EVENT_NAME: 'push',
      GITHUB_SHA: '0'.repeat(40),
      REFRESH_VERSION_PR: 'false',
    },
  });
  const output = fs.readFileSync(outputFile, 'utf8');
  return {
    pending: /^pending_changesets=(\S+)$/m.exec(output)?.[1],
    ids: [...stdout.matchAll(/^pending changeset: (.+)$/gm)].map((match) => match[1]).sort(),
  };
}

async function runReader(dir: string): Promise<string[]> {
  return (await readChangesets(dir)).map((changeset) => changeset.id).sort();
}

/** One case: what the installed reader saw, and what the mirror saw. */
async function bothScans(files: Record<string, string>, script: string = mirrorScript) {
  const dir = makeFixture(files);
  try {
    const mirror = runMirror(dir, script);
    return { reader: await runReader(dir), mirror: mirror.ids, pending: mirror.pending };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('the lane mirror reads the installed @changesets/read, not a transcription of it', () => {
  it('resolves the reader through @changesets/cli, from inside node_modules', () => {
    // Not an aesthetic check. If this ever resolves to something inside the
    // repository, the pin has started guarding a copy instead of the dependency.
    expect(readerManifest.name).toBe('@changesets/read');
    expect(readerManifestPath).toContain(`${path.sep}node_modules${path.sep}`);
    expect(readerEntryPath).toContain(`${path.sep}node_modules${path.sep}`);
    expect(readerEntryPath.startsWith(path.join(repoRoot, 'scripts'))).toBe(false);
    expect(typeof readChangesets).toBe('function');
    // Recorded so a failure elsewhere in this file names the version it measured.
    expect(readerManifest.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('extracts the mirror from the workflow rather than restating it', () => {
    expect(detectStep?.name).toBe('Detect pending changesets');
    expect(mirrorScript).toContain('pending_changesets=');
    expect(mirrorScript).toContain('.changeset/pre/*.md');
  });
});

describe('cases where the mirror must AGREE with the installed @changesets/read', () => {
  it('counts an ordinary changeset', async () => {
    const { reader, mirror } = await bothScans({ 'brave-pandas-smile.md': CHANGESET });
    expect(mirror).toEqual(['brave-pandas-smile']);
    expect(mirror).toEqual(reader);
  });

  it('counts an empty-frontmatter changeset — this repo\'s "nothing to release" form', async () => {
    const { reader, mirror } = await bothScans({ 'ci-only.md': EMPTY_CHANGESET });
    expect(mirror).toEqual(['ci-only']);
    expect(mirror).toEqual(reader);
  });

  it('ignores README.md', async () => {
    const { reader, mirror } = await bothScans({ 'README.md': '# changesets\n' });
    expect(mirror).toEqual([]);
    expect(mirror).toEqual(reader);
  });

  it('ignores a non-canonically-cased README — the reader matches /^README\\.md$/i', async () => {
    // The drift objectui#5775 names, with its spelling corrected by measurement.
    // The card offered `ReadMe.MD` as the case, and that one proves nothing:
    // BOTH scans drop it on the EXTENSION (the reader's `endsWith('.md')` and
    // the mirror's `*.md` glob are each case-SENSITIVE), so they agreed all
    // along. The genuine disagreement needs a canonical extension and a
    // non-canonical stem, which is what this fixture is.
    const { reader, mirror } = await bothScans({ 'ReadMe.md': '# changesets\n' });
    expect(mirror).toEqual([]);
    expect(mirror).toEqual(reader);
  });

  it('ignores a lowercase readme.md', async () => {
    const { reader, mirror } = await bothScans({ 'readme.md': '# changesets\n' });
    expect(mirror).toEqual([]);
    expect(mirror).toEqual(reader);
  });

  it('ignores an uppercase .MD extension — for the extension, not the README rule', async () => {
    // Pinned separately so the reason stays visible: if either side ever
    // case-folds the extension, this file starts counting and the case above
    // stops being the one that tests the README rule.
    const { reader, mirror } = await bothScans({ 'brave-pandas-smile.MD': CHANGESET });
    expect(mirror).toEqual([]);
    expect(mirror).toEqual(reader);
  });

  it('counts .changeset/pre/*.md, with the `pre/` prefix the reader gives their ids', async () => {
    // The other half of the drift: the mirror globbed `.changeset/*.md` only, so
    // this whole directory was invisible to it.
    const { reader, mirror } = await bothScans({ 'pre/probe.md': CHANGESET });
    expect(mirror).toEqual(['pre/probe']);
    expect(mirror).toEqual(reader);
  });

  it('ignores a README inside .changeset/pre/ too — the reader filters on the basename', async () => {
    const { reader, mirror } = await bothScans({ 'pre/README.md': '# pre\n' });
    expect(mirror).toEqual([]);
    expect(mirror).toEqual(reader);
  });

  it('ignores dotfiles', async () => {
    const { reader, mirror } = await bothScans({ '.hidden.md': CHANGESET });
    expect(mirror).toEqual([]);
    expect(mirror).toEqual(reader);
  });

  it('ignores files that are not .md', async () => {
    const { reader, mirror } = await bothScans({ 'notes.txt': 'not a changeset\n' });
    expect(mirror).toEqual([]);
    expect(mirror).toEqual(reader);
  });

  it('counts a lowercase `agents.md` — the reader compares those three names EXACTLY', async () => {
    // Only the README exclusion is case-insensitive. A mirror that case-folded
    // the whole ignore list would under-count here against both readers.
    const { reader, mirror } = await bothScans({ 'agents.md': CHANGESET });
    expect(mirror).toEqual(['agents']);
    expect(mirror).toEqual(reader);
  });

  it('reports pending=false for a tree the reader also finds empty', async () => {
    const { reader, mirror, pending } = await bothScans({ 'README.md': '# changesets\n' });
    expect(reader).toEqual([]);
    expect(mirror).toEqual([]);
    expect(pending).toBe('false');
  });
});

describe('cases where the mirror must deliberately OVER-count the installed reader', () => {
  // `changesets/action@v1` bundles `@changesets/read@^0.6.7`, which does NOT
  // ignore these three. The mirror gates the clear step, whose obligation is
  // one-directional, so counting them is required: ignoring them would skip the
  // clear step while the action still saw a changeset (objectui#5442).
  //
  // One assertion per name, so a regression names which one it broke.
  for (const name of ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md']) {
    it(`counts .changeset/${name}, which the installed reader ignores`, async () => {
      const { reader, mirror, pending } = await bothScans({ [name]: CHANGESET });
      expect(reader).toEqual([]);
      expect(mirror).toEqual([name.replace(/\.md$/, '')]);
      expect(pending).toBe('true');
    });
  }

  it('still pins the action ref those three names are justified by', () => {
    // The bundled copy is a minified chunk behind a moving tag, so it cannot be
    // executed here. What CAN be pinned is the ref: bump it and re-measure the
    // bundle, because the union above may no longer cover it.
    const uses = workflow.jobs.release.steps.map((step) => step.uses).filter(Boolean);
    expect(uses).toContain('changesets/action@v1');
  });
});

describe('the pin can fail (non-vacuity)', () => {
  // Each mutation is asserted to have APPLIED before its result is read — a
  // no-op edit would leave the unmutated script running and report a healthy
  // green that means nothing.
  function mutate(from: string, to: string): string {
    const mutated = mirrorScript.replace(from, to);
    expect(mutated, `mutation did not apply: ${from}`).not.toBe(mirrorScript);
    return mutated;
  }

  it('goes red when `.changeset/pre/` is dropped from the mirror', async () => {
    const script = mutate('for file in .changeset/*.md .changeset/pre/*.md; do', 'for file in .changeset/*.md; do');
    const { reader, mirror } = await bothScans({ 'pre/probe.md': CHANGESET }, script);
    expect(reader).toEqual(['pre/probe']);
    expect(mirror).toEqual([]);
    expect(mirror).not.toEqual(reader);
  });

  it('goes red when the README exclusion is compared case-sensitively again', async () => {
    const script = mutate(
      `[ "$(printf '%s' "\${1##*/}" | tr '[:upper:]' '[:lower:]')" = 'readme.md' ]`,
      `[ "\${1##*/}" = 'README.md' ]`,
    );
    const { reader, mirror } = await bothScans({ 'ReadMe.md': '# changesets\n' }, script);
    expect(reader).toEqual([]);
    expect(mirror).toEqual(['ReadMe']);
    expect(mirror).not.toEqual(reader);
  });

  it('goes red when the mirror stops counting AGENTS.md', async () => {
    // The mutation the mirror's ⛔ comment forbids, made executable: this is the
    // under-count that skips the clear step while the action still sees a file.
    const script = mutate(
      'if is_readme "$file"; then',
      'if is_readme "$file" || [ "${file##*/}" = \'AGENTS.md\' ]; then',
    );
    const { mirror, pending } = await bothScans({ 'AGENTS.md': CHANGESET }, script);
    expect(mirror).toEqual([]);
    expect(pending).toBe('false');
  });
});
