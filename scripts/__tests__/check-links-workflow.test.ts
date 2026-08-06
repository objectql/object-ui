import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * objectui#3449 — `check-links.yml` was pointed at the wrong tree.
 *
 * Its `args` listed `docs/**` and `README.md`. `docs/` is 15 files of INTERNAL
 * material (ADRs, audit reports). The documentation the site actually publishes
 * is the 183 files under `content/docs/**` — `apps/site/source.config.ts`
 * declares `dir: '../../content/docs'` with baseUrl `/docs`. Not one published
 * page had ever been scanned. The workflow was green about a tree nobody reads
 * and silent about the tree everybody does, which is the same failure mode as
 * #3448 / #3261 / #2879 in this repo: a gate that looks configured and simply
 * never sees its subject.
 *
 * The scope is only half the fix, so this file pins both halves:
 *
 *  1. **Scope, derived not copied.** The assertions below do not hard-code
 *     `content/docs`; they read the directory out of `apps/site/source.config.ts`
 *     and require the workflow to cover every markdown file under it. A
 *     hard-coded path would be a second copy of the site's layout, free to
 *     drift from it — which is exactly how this bug was born. Move the content
 *     tree again and this test goes red on the same day, instead of the
 *     workflow going quietly blind for another year.
 *
 *  2. **The `root_dir` / `exclude` pair in `lychee.toml`.** Widening the scope
 *     without it does not produce a working sweep, it produces 316 hard errors:
 *     `content/docs` carries ~297 site-absolute links (`/docs/...`), and Lychee
 *     fails those while CONSTRUCTING the URI — before `exclude` is consulted,
 *     so an `^/docs` exclude pattern cannot suppress them. The two settings only
 *     work together; removing either alone re-breaks the sweep, so neither may
 *     leave without the other.
 *
 * Also pinned: the trigger set. `schedule` must exist (the periodic sweep
 * #3213's ruling B intended, which was correctly withheld until the scope was
 * right), and `push` / `pull_request` must NOT — an external link checker walks
 * the network, and gating PRs on third-party uptime makes other people's work
 * fail for reasons they cannot fix.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflowPath = path.join(repoRoot, '.github/workflows/check-links.yml');
const lycheeConfigPath = path.join(repoRoot, 'lychee.toml');
const siteConfigPath = path.join(repoRoot, 'apps/site/source.config.ts');

/**
 * The workflow YAML with whole-line comments removed.
 *
 * Required, not cosmetic: the header explains at length why `push` and
 * `pull_request` stay disabled and names both of them, and the commented-out
 * trigger block is itself part of the record. A scan that counted either would
 * report triggers this workflow does not have.
 */
function withoutComments(yaml: string): string {
  return yaml
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
}

/** The quoted input patterns from the workflow's `args:` block. */
function scannedPatterns(yaml: string): string[] {
  return [...withoutComments(yaml).matchAll(/^\s*'([^']+)'\s*$/gm)].map((m) => m[1]);
}

/** Every `.md` / `.mdx` file below `dir`, as repo-relative paths. */
function markdownFilesUnder(dir: string): string[] {
  const absolute = path.join(repoRoot, dir);
  if (!fs.existsSync(absolute)) return [];
  const found: string[] = [];
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.mdx?$/.test(entry.name)) found.push(path.relative(repoRoot, full));
    }
  };
  walk(absolute);
  return found;
}

/**
 * Files matched by one input pattern.
 *
 * Only the two shapes the workflow uses are supported — `<dir>/ ** / *.<ext>`
 * and a literal path. Anything else is reported rather than silently counted as
 * zero, because "matches nothing" is the very defect this file exists to catch.
 */
function filesMatching(pattern: string): string[] {
  const glob = /^(.+)\/\*\*\/\*\.([a-z]+)$/.exec(pattern);
  if (glob) {
    const [, base, extension] = glob;
    return markdownFilesUnder(base).filter((file) => file.endsWith(`.${extension}`));
  }
  if (/[*?[\]]/.test(pattern)) {
    throw new Error(`unsupported glob shape in check-links.yml args: ${pattern}`);
  }
  return fs.existsSync(path.join(repoRoot, pattern)) ? [pattern] : [];
}

/** The docs directory the site itself declares, as a repo-relative path. */
function declaredDocsDir(): string {
  const source = fs.readFileSync(siteConfigPath, 'utf8');
  const match = /\bdir:\s*'([^']+)'/.exec(source);
  expect(match, `${siteConfigPath} no longer declares a docs \`dir\``).not.toBeNull();
  const resolved = path.resolve(path.dirname(siteConfigPath), match![1]);
  return path.relative(repoRoot, resolved);
}

const workflowYaml = () => fs.readFileSync(workflowPath, 'utf8');

describe('check-links.yml — the external link sweep looks at the published docs', () => {
  it('scans every markdown file the site is built from', () => {
    // The #3449 assertion. Derived from the site config on purpose: see the
    // header. `content/docs` is never spelled out here.
    const docsDir = declaredDocsDir();
    const published = markdownFilesUnder(docsDir);
    expect(published.length, `no markdown found under the declared docs dir '${docsDir}'`).toBeGreaterThan(100);

    const scanned = new Set(scannedPatterns(workflowYaml()).flatMap(filesMatching));
    const missed = published.filter((file) => !scanned.has(file));
    expect(missed.slice(0, 5), `${missed.length} published doc(s) are not covered by check-links.yml args`).toEqual([]);
  });

  it('still sweeps the repo-root internal docs and README', () => {
    // Ruling on #3449: `docs/**` (ADRs, audits) and README keep their coverage.
    // Widening to the published tree was never meant to narrow anything.
    const scanned = new Set(scannedPatterns(workflowYaml()).flatMap(filesMatching));
    const internal = markdownFilesUnder('docs');
    expect(internal.length, "the repo-root internal docs tree is gone — re-read this workflow's scope").toBeGreaterThan(
      0,
    );

    const missed = internal.filter((file) => !scanned.has(file));
    expect(missed.slice(0, 5), `${missed.length} internal doc(s) are not covered by check-links.yml args`).toEqual([]);
    expect(scanned.has('README.md')).toBe(true);
  });

  it('states its inputs in a shape this test can actually evaluate', () => {
    // Coverage above is asserted per FILE, not per pattern, and that is
    // deliberate: `docs/**/*.mdx` currently matches nothing (the internal tree
    // is all `.md`) and should stay anyway, so that an internal `.mdx` landing
    // tomorrow is swept rather than becoming a fresh blind spot. What must not
    // happen is an args block this test cannot read — it would assert coverage
    // over an empty pattern list and pass while checking nothing.
    const patterns = scannedPatterns(workflowYaml());
    expect(patterns.length, 'no input patterns found in the args block').toBeGreaterThan(2);
    for (const pattern of patterns) expect(() => filesMatching(pattern)).not.toThrow();
  });

  it('runs on a schedule as well as on demand', () => {
    const yaml = withoutComments(workflowYaml());
    expect(yaml, 'the periodic sweep #3213 ruling B intended').toMatch(/^\s*schedule:/m);
    expect(yaml).toMatch(/^\s*-\s*cron:\s*'[^']+'/m);
    expect(yaml).toMatch(/^\s*workflow_dispatch:/m);
  });

  it('does not gate pull requests', () => {
    // #3213 ruling B. Lychee goes over the network; a third-party 502 must not
    // be able to redden somebody's unrelated PR. The commented-out block in the
    // workflow stays commented — `withoutComments` is what makes this real.
    const yaml = withoutComments(workflowYaml());
    expect(yaml, 'external link checking must not become a PR gate — see #3213').not.toMatch(/^\s*pull_request:/m);
    expect(yaml).not.toMatch(/^\s*push:/m);
  });
});

describe('lychee.toml — site-absolute routes are skipped, not resolved', () => {
  it('resolves site-absolute routes into a sentinel root and excludes it', () => {
    // Both halves or neither: `root_dir` alone turns 297 unresolvable links into
    // 297 "file not found" errors, and the exclude alone cannot fire at all,
    // because the failure happens before filtering.
    const config = fs.readFileSync(lycheeConfigPath, 'utf8');
    const rootDir = /^\s*root_dir\s*=\s*"([^"]+)"/m.exec(config);
    expect(rootDir, 'lychee.toml must set root_dir, or site-absolute links are hard errors').not.toBeNull();
    expect(rootDir![1].startsWith('/'), 'root_dir must be an absolute path').toBe(true);
    expect(fs.existsSync(rootDir![1]), 'root_dir is a sentinel namespace and must not exist on disk').toBe(false);
    expect(config, `root_dir ${rootDir![1]} is set but never excluded`).toContain(`"^file://${rootDir![1]}/`);
  });

  it('carries no remap pretending to resolve fumadocs routes', () => {
    // The removed `^/docs/(.*)$ file://./docs/$1` never fired (remap operates on
    // a parsed URL; `/docs/x` fails to parse first) and pointed at the internal
    // `docs/` tree besides. Route-to-file resolution has exactly one owner:
    // scripts/check-doc-links.mjs.
    const config = fs.readFileSync(lycheeConfigPath, 'utf8');
    const active = config
      .split('\n')
      .filter((line) => !/^\s*#/.test(line))
      .join('\n');
    expect(active, 'internal route resolution belongs to scripts/check-doc-links.mjs').not.toMatch(/^\s*remap\s*=/m);
  });
});
