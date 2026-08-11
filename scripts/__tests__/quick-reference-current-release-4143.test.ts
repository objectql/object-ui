import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * objectui#4143: `QUICK_REFERENCE.md`'s "Current Release" block is a deliberately
 * maintained status section — and nothing was maintaining it. At the time this test
 * was written it claimed `v3.3.2`, `@objectstack/spec ^4.0.4` and
 * `@objectstack/client ^4.0.4` against manifests carrying `17.4.0` and
 * `^17.0.0-rc.5`: thirteen majors of drift under a heading that says "Current".
 *
 * The card's premise also said the block's Node/pnpm/React rows were "currently
 * accurate". Two of the three were. **Node was not** — the row read `≥ 20` while
 * root `engines.node` has been `>=22`, and the row *names that anchor in its own
 * text*. A claim that cites its anchor and disagrees with it is the strongest
 * possible argument that review alone does not hold this block: the reviewer had
 * the pointer and still did not follow it.
 *
 * ## Why a per-block pin and not the repo's existing ratchet
 *
 * `scripts/__tests__/doc-version-claims.test.ts` (objectui#3697) already inventories
 * version literals in prose, and its header states the residual hole plainly: its
 * scan roots are `content/docs` and each package README, so "a version literal in
 * a file OUTSIDE the two scan roots is invisible here". `QUICK_REFERENCE.md` sits in
 * that hole, and so does `apps/console/README.md` — which is exactly how objectui#4143
 * became a card at all.
 *
 * Widening those scan roots was considered and rejected for this change. That gate is
 * a RATCHET: it decides whether a literal was *recorded with a reason*, explicitly not
 * whether it is *true* ("It cannot know whether 'Tailwind CSS v3.3+' is true — that
 * would need a per-claim anchor"). Every row in this block HAS a per-claim anchor, so
 * the stronger instrument is available here and the weaker one would have inventoried
 * `^4.0.4` as a known-stale entry rather than caught it. This file follows
 * `ci-cd-pipeline-doc.test.ts` instead: read the doc, read the anchor, derive the
 * expected text FROM the anchor. No version literal is written twice — every expected
 * value below is computed from a manifest, so this test cannot itself go stale.
 *
 * ## The two directions
 *
 * Forward: each anchored row must state what its manifest says. Bump the manifest
 * without touching the block and the row that lies goes red, naming the file to edit.
 *
 * Reverse (the last `it` below): no version literal may appear in the block that this
 * test did not derive. Without it the gate covers only the rows that exist today — a
 * new hand-written `- **Turbo:** 2.x` row would sail in beside them and rot on the
 * same schedule, which is the whole defect class, re-created one bullet to the left.
 *
 * ## The one row nothing here can hold to account
 *
 * `**TypeScript:** ≥ 5.0` has no anchor: no workspace manifest declares a `typescript`
 * peer or engine range, so there is nothing to compare it against. It is a stack floor
 * stated in AGENTS.md §2, and the block says so on the row itself rather than passing
 * it off as a manifest fact. It is allowlisted below by exact text, with a guard that
 * fails the moment an anchor for it DOES appear — the `ci-cd-pipeline-doc.test.ts`
 * move of covering the dangerous direction twice, so the exemption cannot outlive its
 * own justification.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const docRel = 'QUICK_REFERENCE.md';
const doc = fs.readFileSync(path.join(repoRoot, docRel), 'utf8');

interface Manifest {
  name?: string;
  private?: boolean;
  version?: string;
  packageManager?: string;
  engines?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

function manifest(rel: string): Manifest {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, rel), 'utf8')) as Manifest;
}

const rootManifest = manifest('package.json');
const consoleManifest = manifest('apps/console/package.json');
const dataObjectstackManifest = manifest('packages/data-objectstack/package.json');
const reactManifest = manifest('packages/react/package.json');

/**
 * The majors named by a peer range like `^18.0.0 || ^19.0.0`.
 *
 * Split on the `||` comparators first and take the leading number of each — reading
 * majors with one global `\d+\.` sweep instead returns `[18, 0, 19, 0]`, because the
 * patch segments match it too. That mistake fails LOUD here (the row is asserted to
 * name "0.x") but it would fail SILENT in the derived-literal set below, where an
 * extra member only widens what the block is allowed to say.
 */
function peerMajors(range: string): string[] {
  return range
    .split('||')
    .map((comparator) => comparator.trim().match(/^[\^~>=<\s]*(\d+)\./)?.[1])
    .filter((major): major is string => major !== undefined);
}

/**
 * The `## Current Release` section, from its heading to the next `## ` heading (or EOF).
 * Scoping matters: `## Repository Layout` above it also carries numbers, and asserting
 * over the whole file would conflate a status claim with a package count.
 */
function currentReleaseSection(): string {
  const lines = doc.split('\n');
  const start = lines.findIndex((line) => line.trim() === '## Current Release');
  // Thrown rather than asserted: this runs at module load, where a failed `expect` has
  // no test to attach itself to. A throw fails collection with the same message.
  if (start === -1) throw new Error(`${docRel} must still have a "## Current Release" heading`);

  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^## /.test(line));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}

const section = currentReleaseSection();

/**
 * The bullet rows only — the section's prose intro is deliberately excluded.
 *
 * A row may wrap onto continuation lines, so a row runs from its `- **Label:**` line
 * up to the next bullet or blank line. Reading a row as a single physical line would
 * make the gate silently miss whatever a future editor pushes onto line two, which is
 * where the "see root `engines.node`" style of self-citing anchor tends to live.
 */
function rows(): Map<string, string> {
  const out = new Map<string, string>();
  const lines = section.split('\n');

  for (let i = 0; i < lines.length; i += 1) {
    const head = lines[i].match(/^- \*\*(.+?):\*\*\s*(.*)$/);
    if (!head) continue;

    const parts = [head[2]];
    for (let j = i + 1; j < lines.length; j += 1) {
      const next = lines[j];
      if (next.trim() === '' || /^- \*\*/.test(next) || /^>/.test(next)) break;
      parts.push(next.trim());
    }
    out.set(head[1], parts.join(' ').trim());
  }

  return out;
}

const releaseRows = rows();

function row(label: string): string {
  const value = releaseRows.get(label);
  expect(
    value,
    `${docRel}'s "Current Release" block must still have a "- **${label}:**" row ` +
      `(found: ${[...releaseRows.keys()].map((k) => `"${k}"`).join(', ')})`,
  ).toBeDefined();
  return value as string;
}

describe('QUICK_REFERENCE.md "Current Release" — package + spec versions', () => {
  /**
   * Every `@object-ui/*` package is one `fixed` group in `.changeset/config.json`, so
   * "the version" is a single fact about the workspace rather than a per-package one.
   * This asserts that premise before quoting it: if the group ever splits, a single
   * `**Version:**` row stops being expressible and this test says so instead of
   * silently pinning whichever manifest it happened to read.
   */
  it('states the one version every workspace package carries', () => {
    const changesetConfig = JSON.parse(
      fs.readFileSync(path.join(repoRoot, '.changeset/config.json'), 'utf8'),
    ) as { fixed?: string[][] };
    const fixedGroup = changesetConfig.fixed?.[0] ?? [];
    expect(fixedGroup.length, '.changeset/config.json must still declare one `fixed` group').toBeGreaterThan(1);

    const versions = new Map<string, string>();
    for (const rel of ['packages', 'apps'] as const) {
      for (const entry of fs.readdirSync(path.join(repoRoot, rel), { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const pkgRel = `${rel}/${entry.name}/package.json`;
        if (!fs.existsSync(path.join(repoRoot, pkgRel))) continue;
        const pkg = manifest(pkgRel);
        if (!pkg.name || !fixedGroup.includes(pkg.name)) continue;
        versions.set(pkg.name, pkg.version ?? '<none>');
      }
    }

    const distinct = new Set(versions.values());
    expect(
      [...distinct],
      `the changeset \`fixed\` group must carry ONE version; got ${JSON.stringify([...versions])}`,
    ).toHaveLength(1);

    const workspaceVersion = [...distinct][0];
    expect(
      row('Version'),
      `${docRel} must state the workspace version as "${workspaceVersion}"`,
    ).toContain(workspaceVersion);
  });

  it('quotes the `@objectstack/spec` range the manifests declare', () => {
    const fromRoot = rootManifest.devDependencies?.['@objectstack/spec'];
    const fromConsole = consoleManifest.devDependencies?.['@objectstack/spec'];
    expect(fromRoot, 'the root package.json must still declare @objectstack/spec').toBeDefined();
    expect(fromConsole, 'apps/console must still declare @objectstack/spec').toBeDefined();

    // The row names both files as its anchor, so it may only state one literal while
    // the two agree. Disagreement is a real event and belongs in the doc, not hidden.
    expect(
      fromConsole,
      'root and apps/console declare different @objectstack/spec ranges — ' +
        `${docRel}'s Spec row names both as its anchor and can no longer state one value`,
    ).toBe(fromRoot);

    expect(row('Spec'), `${docRel} must state the spec range as "${fromRoot}"`).toContain(fromRoot as string);
  });

  it('quotes the `@objectstack/client` range the manifests declare', () => {
    const fromConsole = consoleManifest.devDependencies?.['@objectstack/client'];
    const fromAdapter = dataObjectstackManifest.dependencies?.['@objectstack/client'];
    expect(fromConsole, 'apps/console must still declare @objectstack/client').toBeDefined();
    expect(fromAdapter, 'packages/data-objectstack must still declare @objectstack/client').toBeDefined();
    expect(
      fromAdapter,
      'apps/console and packages/data-objectstack declare different @objectstack/client ranges — ' +
        `${docRel}'s Client row names both as its anchor and can no longer state one value`,
    ).toBe(fromConsole);

    expect(row('Client'), `${docRel} must state the client range as "${fromConsole}"`).toContain(
      fromConsole as string,
    );
  });
});

describe('QUICK_REFERENCE.md "Current Release" — toolchain rows', () => {
  /**
   * The row that was actually wrong while the card called it accurate. It cites
   * `engines.node` in its own text, so the floor it prints and the floor the manifest
   * declares are now the same number by construction.
   */
  it('states the Node floor from root `engines.node`', () => {
    const engine = rootManifest.engines?.node;
    expect(engine, 'root package.json must still declare engines.node').toBeDefined();

    const floor = (engine as string).match(/(\d+)/)?.[1];
    expect(floor, `engines.node must still carry a numeric floor (got "${engine}")`).toBeDefined();
    expect(
      row('Node.js'),
      `${docRel} must state the Node floor as "≥ ${floor}" to match engines.node "${engine}"`,
    ).toContain(`≥ ${floor}`);
  });

  it('states the pnpm floor and the pinned `packageManager`', () => {
    const engine = rootManifest.engines?.pnpm;
    expect(engine, 'root package.json must still declare engines.pnpm').toBeDefined();
    const floor = (engine as string).match(/(\d+)/)?.[1];

    const pinned = rootManifest.packageManager;
    expect(pinned, 'root package.json must still declare packageManager').toBeDefined();

    const value = row('pnpm');
    expect(value, `${docRel} must state the pnpm floor as "≥ ${floor}"`).toContain(`≥ ${floor}`);
    expect(value, `${docRel} must quote the pinned packageManager "${pinned}"`).toContain(pinned as string);
  });

  /**
   * Derived from a manifest rather than from `react-peer-range-norm-3741.test.ts`'s
   * `REACT_PEER_NORM` constant on purpose: that test already pins every workspace
   * manifest to one range, so any single manifest is representative — and going
   * through the manifest keeps this file free of a second copy of the range.
   */
  it('states the React majors the packages declare as peers', () => {
    const peer = reactManifest.peerDependencies?.react;
    expect(peer, 'packages/react must still declare a react peer range').toBeDefined();

    const majors = peerMajors(peer as string);
    expect(majors.length, `could not read majors out of the react peer range "${peer}"`).toBeGreaterThan(0);

    const value = row('React');
    for (const major of majors) {
      expect(value, `${docRel} must name React ${major}.x — the peer range is "${peer}"`).toContain(`${major}.x`);
    }
  });
});

/**
 * The unanchored row, and the guard that retires the exemption for us.
 *
 * `≥ 5.0` is believed true and is checkable against nothing. If a `typescript` peer or
 * engine range ever lands in a workspace manifest, an anchor exists and the row must
 * start quoting it — so this fails at that moment rather than leaving a stale exemption
 * in place for the next reader to trust.
 */
const UNANCHORED_LITERAL = '≥ 5.0';

describe('QUICK_REFERENCE.md "Current Release" — the unanchored TypeScript row', () => {
  it('is still unanchored, and still says so on the row', () => {
    const anchors: string[] = [];
    for (const rel of ['packages', 'apps'] as const) {
      for (const entry of fs.readdirSync(path.join(repoRoot, rel), { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const pkgRel = `${rel}/${entry.name}/package.json`;
        if (!fs.existsSync(path.join(repoRoot, pkgRel))) continue;
        const pkg = manifest(pkgRel);
        if (pkg.peerDependencies?.typescript || pkg.engines?.typescript) anchors.push(pkgRel);
      }
    }

    expect(
      anchors,
      `a typescript range is now declared in ${anchors.join(', ')} — ${docRel}'s TypeScript row ` +
        'has an anchor at last and must be pinned to it here, replacing this exemption',
    ).toEqual([]);

    const value = row('TypeScript');
    expect(value, `${docRel}'s TypeScript row must still state "${UNANCHORED_LITERAL}"`).toContain(
      UNANCHORED_LITERAL,
    );
    expect(
      value,
      `${docRel}'s TypeScript row is the one unanchored claim in the block and must keep saying so, ` +
        'so a reader can tell it apart from the rows a test holds to account',
    ).toMatch(/not a manifest fact/i);
  });
});

/**
 * A version literal, in the spellings this block uses. Deliberately narrow in the same
 * way `doc-version-claims.test.ts` argues for: a bare integer is not a version (the
 * rows contain `§2`, and prose elsewhere counts things), so a literal must be
 * operator-prefixed or dotted.
 */
const VERSION_LITERAL = /(?:\^|~|>=|<=|>|<|≥|≤)\s*v?\d[\w.-]*|\bv?\d+\.[A-Za-z0-9][\w.-]*/g;

const normalize = (literal: string): string => literal.replace(/\s+/g, '');

describe('QUICK_REFERENCE.md "Current Release" — no un-derived literal', () => {
  it('contains only version literals this test derives from a manifest', () => {
    const derived = new Set<string>();
    const add = (literal: string | undefined): void => {
      if (literal) derived.add(normalize(literal));
    };

    add(consoleManifest.version);
    add(rootManifest.devDependencies?.['@objectstack/spec']);
    add(consoleManifest.devDependencies?.['@objectstack/client']);
    add(`≥ ${rootManifest.engines?.node?.match(/(\d+)/)?.[1]}`);
    add(`≥ ${rootManifest.engines?.pnpm?.match(/(\d+)/)?.[1]}`);
    add(rootManifest.packageManager?.split('@').pop());
    for (const major of peerMajors(reactManifest.peerDependencies?.react ?? '')) {
      add(`${major}.x`);
    }
    add(UNANCHORED_LITERAL);

    const undecided: string[] = [];
    for (const value of releaseRows.values()) {
      for (const match of value.matchAll(VERSION_LITERAL)) {
        if (!derived.has(normalize(match[0]))) undecided.push(match[0]);
      }
    }

    expect(
      undecided,
      `${docRel}'s "Current Release" block states ${JSON.stringify(undecided)}, which no manifest in ` +
        'this tree produced. Every row under a heading that says "Current" must be derived from an ' +
        'anchor and asserted above, or it is the next objectui#4143. Derived values are: ' +
        `${JSON.stringify([...derived])}.`,
    ).toEqual([]);
  });
});
