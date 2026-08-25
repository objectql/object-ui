import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Plain-JS CI helper; its types are inferred from the .mjs source by
// `tsconfig.scripts.json` (`allowJs`), so no `@ts-expect-error` here.
import {
  FRAGMENT_MARKER_EXAMPLES,
  UNDECLARED_CONTROL_PACKAGE,
  UNGATED_DOCS,
  analyze,
  deriveDeclaredDependencyPaths,
  derivePackageTypePaths,
  findInstalledCopy,
  listDocuments,
  scanFences,
} from '../check-doc-snippet-types.mjs';

/**
 * objectui#5138 shape 2 — the test for `scripts/check-doc-snippet-types.mjs`.
 *
 * The gate compiles documentation snippets against the BUILT types. Its three
 * self-controls (resolution / sentinel / positive) can only be exercised against
 * a real build, which this suite deliberately does not do — a unit test that
 * needed `turbo run build` would stop running per-PR. So what is pinned here is
 * everything that can go wrong WITHOUT a build, in the order it would hurt:
 *
 *  1. **The fragment rule**, because its failure mode is silent. A marker that
 *     attaches to the wrong block, or a block that gets skipped without a
 *     declaration, converts a real defect into a green.
 *  2. **The ledger is re-derived, never trusted** — an entry for a file that no
 *     longer exists, or that holds no snippet, is a hole that reads as coverage.
 *  3. **The scan cannot collapse quietly.** An empty walk makes every other
 *     assertion vacuous, which is how a gate reports green over nothing.
 *  4. **The types come from `dist`, never from `src`.** The repository's own root
 *     `tsconfig.json` maps the workspace to source; a harness that inherited it
 *     would check the docs against code no consumer sees.
 *  5. **The gate is wired**, in a workflow a docs-only pull request can start.
 *  6. **Third-party resolution reaches exactly as far as the imported packages
 *     DECLARE** (objectui#6120). This one's failure mode is the worst in the list
 *     because it is invisible: widen resolution past the declarations and every
 *     document stays green while the gate stops being able to fail. The suite
 *     therefore pins both directions — a declared dependency IS mapped, and an
 *     installed-but-undeclared one is NOT — plus the two preconditions the
 *     UNDECLARED control needs in order to mean anything.
 *
 * Fixtures are throwaway trees, never `content/docs`: a committed fixture page
 * would have to contain a deliberately broken snippet, and this very gate scans
 * that directory.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = 'scripts/check-doc-snippet-types.mjs';

interface Finding {
  reason: string;
  site: string;
  detail?: string;
}

function tempTree(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-snippet-gate-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  fs.mkdirSync(path.join(root, 'packages'), { recursive: true });
  return root;
}

const FENCE = '```';

describe('fence scanning', () => {
  it('reads ts, tsx and typescript fences and nothing else', () => {
    const { blocks } = scanFences(
      [
        `${FENCE}ts`,
        'export const a = 1;',
        FENCE,
        `${FENCE}tsx`,
        'export const b = <div />;',
        FENCE,
        `${FENCE}typescript`,
        'export const c = 2;',
        FENCE,
        `${FENCE}json`,
        '{ "type": "grid" }',
        FENCE,
        `${FENCE}bash`,
        'pnpm install',
        FENCE,
      ].join('\n'),
    );
    expect(blocks.map((b) => b.language)).toEqual(['ts', 'tsx', 'typescript']);
  });

  it('does not read a ts fence nested inside a wider fence as a block of its own', () => {
    // A four-backtick wrapper is how this repo's docs quote markdown that itself
    // contains a fence. Reading the inner one would compile prose.
    const { blocks } = scanFences(
      ['````markdown', `${FENCE}ts`, 'not really a snippet', FENCE, '````'].join('\n'),
    );
    expect(blocks).toHaveLength(0);
  });

  it('attaches a fragment marker only to the fence directly beneath it', () => {
    const { blocks } = scanFences(
      [
        '{/* doc-snippet: fragment — continues the block above */}',
        '',
        `${FENCE}ts`,
        'first',
        FENCE,
        '',
        'Prose in between resets the declaration.',
        '',
        `${FENCE}ts`,
        'second',
        FENCE,
      ].join('\n'),
    );
    expect(blocks).toHaveLength(2);
    expect(blocks[0].fragmentReason).toBe('continues the block above');
    expect(blocks[1].fragmentReason).toBeNull();
  });

  it('accepts both marker spellings, and both examples in the script are real markers', () => {
    for (const example of FRAGMENT_MARKER_EXAMPLES) {
      const { blocks } = scanFences([example, `${FENCE}ts`, 'x', FENCE].join('\n'));
      expect(blocks[0].fragmentReason, `${example} did not declare its block`).toBeTruthy();
    }
  });

  it('reports a marker that declares nothing rather than ignoring it', () => {
    const root = tempTree({
      'content/docs/a.mdx': ['{/* doc-snippet: fragment — nothing follows this */}', '', 'Just prose.'].join('\n'),
    });
    const findings = analyze({ root, ungated: {} }).findings as Finding[];
    expect(findings.map((f) => f.reason)).toContain('stale-fragment-marker');
  });

  it('rejects a fragment declaration with no written reason', () => {
    const root = tempTree({
      'content/docs/a.mdx': ['{/* doc-snippet: fragment — short */}', `${FENCE}ts`, 'x', FENCE].join('\n'),
    });
    const findings = analyze({ root, ungated: {} }).findings as Finding[];
    expect(findings.map((f) => f.reason)).toContain('unexplained-fragment');
  });
});

describe('the coverage ledger is re-derived, never trusted', () => {
  it('fails on an entry naming a document that does not exist', () => {
    const root = tempTree({ 'content/docs/a.mdx': [`${FENCE}ts`, 'export const a = 1;', FENCE].join('\n') });
    const findings = analyze({ root, ungated: { 'content/docs/gone.mdx': 'a reason long enough' } })
      .findings as Finding[];
    expect(findings.some((f) => f.reason === 'stale-ungated-entry')).toBe(true);
  });

  it('fails on an entry for a document that holds no snippet at all', () => {
    const root = tempTree({ 'content/docs/a.mdx': 'Only prose lives here.' });
    const findings = analyze({ root, ungated: { 'content/docs/a.mdx': 'a reason long enough' } })
      .findings as Finding[];
    expect(findings.some((f) => f.reason === 'stale-ungated-entry')).toBe(true);
  });

  it('fails on an entry with no written reason — a bare path is not a declaration', () => {
    const root = tempTree({ 'content/docs/a.mdx': [`${FENCE}ts`, 'export const a = 1;', FENCE].join('\n') });
    const findings = analyze({ root, ungated: { 'content/docs/a.mdx': '' } }).findings as Finding[];
    expect(findings.some((f) => f.reason === 'unexplained-ungated-entry')).toBe(true);
  });

  it('covers a document nobody declared — the default is COVERED, so a new page is gated on arrival', () => {
    const root = tempTree({
      'content/docs/new-page.mdx': [`${FENCE}ts`, 'export const a = 1;', FENCE].join('\n'),
    });
    const state = analyze({ root, ungated: {} });
    expect(state.covered).toContain('content/docs/new-page.mdx');
    expect(state.compiled).toHaveLength(1);
  });

  it('every entry in the real ledger carries a written reason', () => {
    for (const [doc, reason] of Object.entries(UNGATED_DOCS as Record<string, string>)) {
      expect(reason.trim().length, `${doc} is listed with no reason`).toBeGreaterThan(11);
    }
  });
});

describe('this repository', () => {
  it('scans a plausible number of documents — an empty walk makes every verdict vacuous', () => {
    const documents = listDocuments(repoRoot);
    expect(documents.length).toBeGreaterThan(100);
    expect(documents.some((d: string) => d.startsWith('content/docs/'))).toBe(true);
    expect(documents.some((d: string) => /^packages\/[^/]+\/README\.md$/.test(d))).toBe(true);
  });

  it('is green, and the ledger is exact', () => {
    const state = analyze({});
    const findings = state.findings as Finding[];
    // `unbuilt-package` is the one finding a test run without a build produces,
    // and it is the gate reporting honestly rather than a stale ledger.
    expect(findings.filter((f) => f.reason !== 'unbuilt-package')).toEqual([]);
  });

  it('has snippets to judge — the covered set is not empty', () => {
    const state = analyze({});
    expect(state.compiled.length).toBeGreaterThan(20);
  });

  it('resolves the workspace to built artifacts, never to a package src/', () => {
    const { paths } = derivePackageTypePaths(repoRoot);
    const targets = Object.values(paths as Record<string, string[]>).map((v) => v[0]);
    expect(targets.length).toBeGreaterThan(20);
    for (const target of targets) {
      expect(target, 'a snippet must be judged against the surface a consumer imports').not.toMatch(
        /[\\/]packages[\\/][^\\/]+[\\/]src[\\/]/,
      );
      expect(target).toMatch(/\.d\.ts$/);
    }
  });
});

describe('third-party resolution reaches exactly as far as the imported packages declare', () => {
  /** A workspace package with its own `node_modules`, the way pnpm links one. */
  function treeWithDependency(files: Record<string, string> = {}): string {
    return tempTree({
      'content/docs/a.mdx': [FENCE + 'ts', "import 'declared-dep';", FENCE].join('\n'),
      'packages/pkg-a/package.json': JSON.stringify({
        name: 'pkg-a',
        dependencies: { 'declared-dep': '^1.0.0' },
        peerDependencies: { 'peer-dep': '^1.0.0' },
        devDependencies: { 'dev-dep': '^1.0.0' },
      }),
      'packages/pkg-a/node_modules/declared-dep/package.json': JSON.stringify({
        name: 'declared-dep',
        types: 'index.d.ts',
      }),
      'packages/pkg-a/node_modules/declared-dep/index.d.ts': 'export declare const declared: number;\n',
      // Installed right beside it and NOT declared: the shape a blanket mapping
      // over node_modules would pick up, and the one no consumer can import.
      'packages/pkg-a/node_modules/undeclared-dep/package.json': JSON.stringify({
        name: 'undeclared-dep',
        types: 'index.d.ts',
      }),
      'packages/pkg-a/node_modules/undeclared-dep/index.d.ts': 'export declare const undeclared: number;\n',
      'packages/pkg-a/node_modules/peer-dep/package.json': JSON.stringify({ name: 'peer-dep', types: 'index.d.ts' }),
      'packages/pkg-a/node_modules/peer-dep/index.d.ts': 'export declare const peer: number;\n',
      'packages/pkg-a/node_modules/dev-dep/package.json': JSON.stringify({ name: 'dev-dep', types: 'index.d.ts' }),
      'packages/pkg-a/node_modules/dev-dep/index.d.ts': 'export declare const dev: number;\n',
      ...files,
    });
  }

  const derive = (root: string, imported: string[] = ['pkg-a']) =>
    deriveDeclaredDependencyPaths(root, imported, { 'pkg-a': 'packages/pkg-a' }) as unknown as {
      paths: Record<string, string[]>;
      declaredBy: Record<string, string>;
      untyped: { specifier: string }[];
    };

  it('maps a specifier the imported package DECLARES — that is what a consumer resolves', () => {
    const { paths, declaredBy } = derive(treeWithDependency());
    expect(Object.keys(paths)).toContain('declared-dep');
    expect(paths['declared-dep'][0]).toMatch(/declared-dep[\\/]index\.d\.ts$/);
    expect(declaredBy['declared-dep']).toBe('pkg-a');
  });

  it('does NOT map a package that is merely INSTALLED — the control that keeps this a check', () => {
    // If this ever passes, resolution has been widened to a blanket mapping and
    // a snippet may import what no reader of these packages can get.
    const { paths } = derive(treeWithDependency());
    expect(Object.keys(paths)).not.toContain('undeclared-dep');
  });

  it('does not map peerDependencies or devDependencies — it fails CLOSED', () => {
    const { paths } = derive(treeWithDependency());
    expect(Object.keys(paths)).not.toContain('peer-dep');
    expect(Object.keys(paths)).not.toContain('dev-dep');
  });

  it('maps nothing for a package no covered document imports', () => {
    const { paths } = derive(treeWithDependency(), []);
    expect(paths).toEqual({});
  });

  it('leaves a specifier that ships no types unresolvable rather than approximating it', () => {
    // A JS-only dependency: declared, installed, and carrying nothing a strict
    // program can judge. Mapping it to something approximate would report green
    // over a snippet nobody type-checked; leaving it unresolvable fails honestly.
    const root = tempTree({
      'packages/pkg-a/package.json': JSON.stringify({
        name: 'pkg-a',
        dependencies: { 'untyped-dep': '^1.0.0' },
      }),
      'packages/pkg-a/node_modules/untyped-dep/package.json': JSON.stringify({
        name: 'untyped-dep',
        main: 'index.js',
      }),
      'packages/pkg-a/node_modules/untyped-dep/index.js': 'module.exports = {};\n',
    });
    const { paths, untyped } = derive(root);
    expect(Object.keys(paths)).not.toContain('untyped-dep');
    expect(untyped.map((u) => u.specifier)).toContain('untyped-dep');
  });

  it('never maps a workspace package — those come from their own exports, or deliberately not at all', () => {
    const root = tempTree({
      'packages/pkg-a/package.json': JSON.stringify({ name: 'pkg-a', dependencies: { 'pkg-b': 'workspace:*' } }),
      'packages/pkg-a/node_modules/pkg-b/package.json': JSON.stringify({ name: 'pkg-b', types: 'src/index.ts' }),
      'packages/pkg-a/node_modules/pkg-b/src/index.ts': 'export const b = 1;\n',
    });
    const { paths } = deriveDeclaredDependencyPaths(root, ['pkg-a'], {
      'pkg-a': 'packages/pkg-a',
      'pkg-b': 'packages/pkg-b',
    }) as unknown as { paths: Record<string, string[]> };
    expect(Object.keys(paths)).not.toContain('pkg-b');
  });

  describe('in this repository', () => {
    it("maps lucide-react, which the documented packages declare (objectui#6120)", () => {
      const state = analyze({}) as unknown as {
        dependencyPaths: Record<string, string[]>;
        dependencyDeclaredBy: Record<string, string>;
      };
      expect(Object.keys(state.dependencyPaths)).toContain('lucide-react');
      expect(state.dependencyPaths['lucide-react'][0]).toMatch(/\.d\.ts$/);
    });

    it('maps only declaration files, and never a package src/', () => {
      const state = analyze({}) as unknown as { dependencyPaths: Record<string, string[]> };
      const targets = Object.values(state.dependencyPaths).map((v) => v[0]);
      expect(targets.length).toBeGreaterThan(10);
      for (const target of targets) {
        expect(target).toMatch(/\.d\.(ts|mts|cts)$/);
        expect(target, 'a snippet must never be judged against a package src/').not.toMatch(
          /[\\/]packages[\\/][^\\/]+[\\/]src[\\/]/,
        );
      }
    });

    it('the UNDECLARED control specifier is installed here — otherwise it proves nothing', () => {
      expect(
        findInstalledCopy(repoRoot, UNDECLARED_CONTROL_PACKAGE),
        `${UNDECLARED_CONTROL_PACKAGE} is not installed, so "it does not resolve" measures nothing`,
      ).toBeTruthy();
    });

    it('the UNDECLARED control specifier is declared by no workspace package at all', () => {
      const packagesDir = path.join(repoRoot, 'packages');
      const declaring = fs
        .readdirSync(packagesDir)
        .filter((d) => fs.existsSync(path.join(packagesDir, d, 'package.json')))
        .filter((d) => {
          const manifest = JSON.parse(
            fs.readFileSync(path.join(packagesDir, d, 'package.json'), 'utf8'),
          ) as { dependencies?: Record<string, string> };
          return Boolean(manifest.dependencies?.[UNDECLARED_CONTROL_PACKAGE]);
        });
      expect(declaring, 'pick a control specifier no package declares').toEqual([]);
    });
  });
});

describe('wiring — a script nothing runs is not a gate', () => {
  const workflowDir = path.join(repoRoot, '.github/workflows');
  const workflowPath = path.join(workflowDir, 'doc-snippet-types.yml');
  const workflowFiles = fs.readdirSync(workflowDir).filter((f) => f.endsWith('.yml'));

  /** A workflow's YAML with whole-line comments removed — the headers in this
   *  repository name other workflows and other scripts in prose. */
  const yamlOf = (file: string): string =>
    fs
      .readFileSync(path.join(workflowDir, file), 'utf8')
      .split('\n')
      .filter((line) => !/^\s*#/.test(line))
      .join('\n');

  it('has a workflow that gates pull requests, not just pushes', () => {
    expect(fs.existsSync(workflowPath), 'a check nothing runs is not a gate').toBe(true);
    const yaml = yamlOf('doc-snippet-types.yml');
    expect(yaml).toContain('pull_request:');
    expect(yaml).toContain(SCRIPT);
  });

  it('runs it in NO path-filtered workflow — the change that breaks a snippet is docs-only', () => {
    expect(workflowFiles.length, 'the workflow directory scan returned implausibly few files').toBeGreaterThan(5);
    for (const file of workflowFiles) {
      const yaml = yamlOf(file);
      if (!yaml.includes(SCRIPT)) continue;
      expect(yaml, `${file} filters paths and would miss a docs-only change`).not.toMatch(
        /^\s*paths(-ignore)?:/m,
      );
    }
  });

  it('lives in exactly one workflow — one gate, one home', () => {
    expect(workflowFiles.filter((f) => yamlOf(f).includes(SCRIPT))).toEqual(['doc-snippet-types.yml']);
  });

  it('builds a FILTER, never the whole workspace', () => {
    const yaml = yamlOf('doc-snippet-types.yml');
    expect(yaml).toContain('--build-filter');
    expect(yaml, 'the 2026-08-16 ruling on objectui#4846 rejected a per-PR full-repo build').not.toMatch(
      /run: pnpm( exec turbo run)? build\s*$/m,
    );
  });

  it('is reachable by name from the workspace root', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    expect(pkg.scripts['check:doc-snippets']).toBe(`node ${SCRIPT}`);
  });
});
