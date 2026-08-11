import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Plain-JS CI helper. Its types are INFERRED from the .mjs source by
// `tsconfig.scripts.json` (`allowJs`), so no `@ts-expect-error` here —
// re-adding one is now itself an error (TS2578). See objectui#3494.
import {
  auditPackages,
  collect,
  listTestFiles,
  programPatterns,
  programReads,
  testsCovered,
  tsPatternToRegExp,
} from '../check-type-check-coverage.mjs';

/**
 * objectui#3968 — the test for `scripts/check-type-check-coverage.mjs`.
 *
 * The gate reported green while four test files in `examples/schema-catalog` were
 * read by no `tsc` invocation at all, and it did so for TWO independent reasons
 * that happened to overlap on that one package:
 *
 *  1. it counted test files by recursing `src/` only, and those tests live in
 *     `test/` — so the count was 0 and the whole "tests are code too" section
 *     `continue`d past the package;
 *  2. it decided "the build already compiles them" by probing the tsconfig TEXT
 *     for a `*.test.` glob, and that package keeps its tests out of the build by
 *     naming the DIRECTORY (`"exclude": ["test"]`) — so the probe found nothing
 *     and the package read as covered.
 *
 * The fix replaced both text heuristics with one question asked of the resolved
 * program: walk the whole package for test files, then resolve each tsconfig's
 * `files`/`include`/`exclude` (through `extends`) and ask whether it really reads
 * them. This suite is the reverse pin on that. Every fixture is a throwaway
 * package tree, never this repository's own packages — a committed fixture would
 * have to contain a deliberately unchecked test file, and this very gate would
 * eventually find it.
 *
 * The one exception is the last block, which asserts against the REAL repository
 * that `examples/schema-catalog` is now wired up. That is deliberate: the whole
 * point of #3968 was that nothing noticed when it was not.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** All tables empty, so a fixture tree is judged on its own merits. */
const NO_TABLES = { debt: {}, notCompiled: [], checkedByOwnBuild: {}, testDebt: {} };

/** Builds a throwaway workspace and runs the REAL collector + audit over it. */
function withWorkspace(
  build: (write: (rel: string, contents: string) => void) => void,
  run: (verdict: { dir: string; errors: string[]; packages: ReturnType<typeof collect> }) => void,
): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-type-check-coverage-'));
  const write = (rel: string, contents: string) => {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents);
  };
  try {
    build(write);
    const packages = collect(dir);
    run({ dir, errors: auditPackages(packages, { ...NO_TABLES, root: dir }), packages });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const manifest = (name: string, typeCheck: string) =>
  JSON.stringify({ name, version: '0.0.0', private: true, scripts: { 'type-check': typeCheck } }, null, 2);

const A_TEST = ['import { it, expect } from "vitest";', 'it("works", () => expect(1).toBe(1));', ''].join('\n');

/**
 * The two predicates the gate USED to use, reproduced verbatim so the blind spots
 * are executable statements rather than a story in a comment. Each fixture below
 * that must be red is also asserted to have been INVISIBLE to these — that is
 * what stops a future simplification from quietly restoring one.
 */
const legacyTestFileCount = (packageDir: string): number => listTestFiles(path.join(packageDir, 'src')).length;
const legacyBuildExcludesTests = (tsconfigText: string): boolean => /\*\.test\./.test(tsconfigText);

describe('listTestFiles — what counts as a test file, and where it may live', () => {
  it('walks the whole package, not just src/ (blind spot 1)', () => {
    withWorkspace(
      (write) => {
        write('packages/demo/package.json', manifest('@fixture/demo', 'tsc --noEmit'));
        write('packages/demo/tsconfig.json', JSON.stringify({ include: ['src/**/*'] }));
        write('packages/demo/src/a.test.ts', A_TEST);
        write('packages/demo/test/b.test.tsx', A_TEST);
        write('packages/demo/test/nested/c.test.ts', A_TEST);
      },
      ({ packages }) => {
        const pkg = packages.find((p) => p.name === '@fixture/demo');
        expect(pkg?.testFilePaths.sort()).toEqual(['src/a.test.ts', 'test/b.test.tsx', 'test/nested/c.test.ts']);
      },
    );
  });

  it('skips build output and tool state, so a copy in dist is not a test file', () => {
    withWorkspace(
      (write) => {
        write('packages/demo/package.json', manifest('@fixture/demo', 'tsc --noEmit'));
        write('packages/demo/tsconfig.json', JSON.stringify({ include: ['src/**/*'] }));
        write('packages/demo/test/real.test.ts', A_TEST);
        write('packages/demo/dist/real.test.ts', A_TEST);
        write('packages/demo/node_modules/dep/x.test.ts', A_TEST);
        write('packages/demo/coverage/x.test.ts', A_TEST);
        write('packages/demo/.turbo/x.test.ts', A_TEST);
      },
      ({ packages }) => {
        expect(packages.find((p) => p.name === '@fixture/demo')?.testFilePaths).toEqual(['test/real.test.ts']);
      },
    );
  });
});

describe('include/exclude semantics — a directory is a directory (blind spot 2)', () => {
  it('treats an extension-less, wildcard-less pattern as a recursive directory', () => {
    expect(tsPatternToRegExp('/repo/pkg/test').test('/repo/pkg/test/a.test.ts')).toBe(true);
    expect(tsPatternToRegExp('/repo/pkg/test').test('/repo/pkg/test/deep/a.test.ts')).toBe(true);
    expect(tsPatternToRegExp('/repo/pkg/test').test('/repo/pkg/testing/a.test.ts')).toBe(false);
  });

  it('matches ** across any number of directories, including none', () => {
    const pattern = tsPatternToRegExp('/repo/pkg/src/**/*.test.ts');
    expect(pattern.test('/repo/pkg/src/a.test.ts')).toBe(true);
    expect(pattern.test('/repo/pkg/src/deep/deeper/a.test.ts')).toBe(true);
    expect(pattern.test('/repo/pkg/src/a.test.tsx')).toBe(false);
  });

  it('reads a tsconfig whose comments contain globs (a naive strip eats them)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-type-check-coverage-jsonc-'));
    try {
      const file = path.join(dir, 'tsconfig.json');
      fs.writeFileSync(
        file,
        ['{', '  /* block comment mentioning src/*.test.ts */', '  "include": ["src/**/*"],', '  "exclude": ["test"],', '}', ''].join(
          '\n',
        ),
      );
      const patterns = programPatterns(file);
      expect(patterns.include?.patterns).toEqual(['src/**/*']);
      expect(patterns.exclude?.patterns).toEqual(['test']);
      expect(programReads(patterns, path.join(dir, 'src', 'a.ts'))).toBe(true);
      expect(programReads(patterns, path.join(dir, 'test', 'a.test.ts'))).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('inherits files/include/exclude through extends, relative to the config that declared them', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-type-check-coverage-extends-'));
    try {
      fs.writeFileSync(path.join(dir, 'base.json'), JSON.stringify({ include: ['src/**/*'], exclude: ['test'] }));
      fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({ extends: './base.json' }));
      const patterns = programPatterns(path.join(dir, 'tsconfig.json'));
      expect(programReads(patterns, path.join(dir, 'src', 'a.ts'))).toBe(true);
      // The inherited directory exclude still applies — this is the trap that made
      // the first draft of examples/schema-catalog/tsconfig.test.json compile zero
      // files (TS18003).
      expect(programReads(patterns, path.join(dir, 'test', 'a.test.ts'))).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('section 5c — a test file no program reads fails the gate', () => {
  it('the exact objectui#3968 shape: tests in test/, kept out by a directory exclude', () => {
    const tsconfig = JSON.stringify({ include: ['src/**/*'], exclude: ['node_modules', 'dist', 'test'] }, null, 2);
    withWorkspace(
      (write) => {
        write('examples/catalog/package.json', manifest('@fixture/catalog', 'tsc --noEmit'));
        write('examples/catalog/tsconfig.json', tsconfig);
        write('examples/catalog/src/index.ts', 'export const catalog = 1;\n');
        write('examples/catalog/test/smoke.test.tsx', A_TEST);
      },
      ({ dir, errors, packages }) => {
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('@fixture/catalog (examples/catalog) has 1 test file that no `tsc`');
        expect(errors[0]).toContain('test/smoke.test.tsx');
        expect(testsCovered(packages[0])).toBe(false);

        // And this is what the two old predicates said about the same tree:
        // nothing at all, each for its own reason. Both blind spots, executable.
        expect(legacyTestFileCount(path.join(dir, 'examples/catalog'))).toBe(0);
        expect(legacyBuildExcludesTests(tsconfig)).toBe(false);
      },
    );
  });

  it('the shape one step over: no exclude at all, an include that never reaches test/', () => {
    // A fix that only taught the gate to recognise directory-form excludes would
    // still pass this tree — the tests are missed by the INCLUDE, and there is no
    // exclude to recognise.
    const tsconfig = JSON.stringify({ include: ['src/**/*'] }, null, 2);
    withWorkspace(
      (write) => {
        write('packages/demo/package.json', manifest('@fixture/demo', 'tsc --noEmit'));
        write('packages/demo/tsconfig.json', tsconfig);
        write('packages/demo/src/index.ts', 'export const demo = 1;\n');
        write('packages/demo/test/a.test.ts', A_TEST);
        write('packages/demo/test/b.test.ts', A_TEST);
      },
      ({ dir, errors }) => {
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('has 2 test files that no `tsc`');
        expect(legacyTestFileCount(path.join(dir, 'packages/demo'))).toBe(0);
        expect(legacyBuildExcludesTests(tsconfig)).toBe(false);
      },
    );
  });

  it('still fails the classic shape it always caught: glob exclude, tests in src', () => {
    withWorkspace(
      (write) => {
        write('packages/demo/package.json', manifest('@fixture/demo', 'tsc --noEmit'));
        write(
          'packages/demo/tsconfig.json',
          JSON.stringify({ include: ['src'], exclude: ['node_modules', 'dist', '**/*.test.ts'] }, null, 2),
        );
        write('packages/demo/src/index.ts', 'export const demo = 1;\n');
        write('packages/demo/src/a.test.ts', A_TEST);
      },
      ({ errors }) => {
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('has 1 test file that no `tsc`');
      },
    );
  });

  it('says nothing when the build program really does compile the tests', () => {
    withWorkspace(
      (write) => {
        write('packages/demo/package.json', manifest('@fixture/demo', 'tsc --noEmit'));
        write('packages/demo/tsconfig.json', JSON.stringify({ include: ['src'] }, null, 2));
        write('packages/demo/src/index.ts', 'export const demo = 1;\n');
        write('packages/demo/src/a.test.ts', A_TEST);
      },
      ({ errors, packages }) => {
        expect(errors).toEqual([]);
        expect(packages[0].buildSkipsTests).toBe(false);
      },
    );
  });

  it('says nothing about a package that has no test files at all', () => {
    withWorkspace(
      (write) => {
        write('packages/demo/package.json', manifest('@fixture/demo', 'tsc --noEmit'));
        write('packages/demo/tsconfig.json', JSON.stringify({ include: ['src'], exclude: ['test'] }, null, 2));
        write('packages/demo/src/index.ts', 'export const demo = 1;\n');
      },
      ({ errors }) => expect(errors).toEqual([]),
    );
  });
});

describe('section 5b — a chained test project that does not read the tests', () => {
  const wiredManifest = manifest('@fixture/catalog', 'tsc --noEmit && tsc -p tsconfig.test.json');
  const buildConfig = JSON.stringify({ include: ['src/**/*'], exclude: ['node_modules', 'dist', 'test'] }, null, 2);

  it('accepts a project that reads every test file the build skips', () => {
    withWorkspace(
      (write) => {
        write('examples/catalog/package.json', wiredManifest);
        write('examples/catalog/tsconfig.json', buildConfig);
        write(
          'examples/catalog/tsconfig.test.json',
          JSON.stringify(
            {
              extends: './tsconfig.json',
              compilerOptions: { noEmit: true },
              include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
              exclude: ['node_modules', 'dist'],
            },
            null,
            2,
          ),
        );
        write('examples/catalog/src/index.ts', 'export const catalog = 1;\n');
        write('examples/catalog/test/smoke.test.tsx', A_TEST);
      },
      ({ errors, packages }) => {
        expect(errors).toEqual([]);
        expect(testsCovered(packages[0])).toBe(true);
      },
    );
  });

  it("rejects a project that inherits the build config's directory exclude and so compiles nothing", () => {
    // The mistake this file's author actually made. `tsc` happens to shout
    // TS18003 when the count reaches zero, but a project covering only SOME of
    // the tests is silent — which is why the gate checks the files, not the text.
    withWorkspace(
      (write) => {
        write('examples/catalog/package.json', wiredManifest);
        write('examples/catalog/tsconfig.json', buildConfig);
        write(
          'examples/catalog/tsconfig.test.json',
          JSON.stringify(
            {
              extends: './tsconfig.json',
              compilerOptions: { noEmit: true },
              include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
            },
            null,
            2,
          ),
        );
        write('examples/catalog/src/index.ts', 'export const catalog = 1;\n');
        write('examples/catalog/test/smoke.test.tsx', A_TEST);
      },
      ({ errors }) => {
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('tsconfig.test.json does not read 1 of the');
        expect(errors[0]).toContain('test/smoke.test.tsx');
      },
    );
  });

  it('rejects a project whose include points at the wrong directory', () => {
    withWorkspace(
      (write) => {
        write('examples/catalog/package.json', wiredManifest);
        write('examples/catalog/tsconfig.json', buildConfig);
        write(
          'examples/catalog/tsconfig.test.json',
          JSON.stringify(
            {
              compilerOptions: { noEmit: true },
              // Mentions a `*.test.` glob — enough for the old text probe — while
              // reading nothing: the tests are in `test/`.
              include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
            },
            null,
            2,
          ),
        );
        write('examples/catalog/src/index.ts', 'export const catalog = 1;\n');
        write('examples/catalog/test/smoke.test.tsx', A_TEST);
      },
      ({ errors }) => {
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('does not read 1 of the');
      },
    );
  });

  it('still requires the chained project to be emit-free', () => {
    withWorkspace(
      (write) => {
        write('examples/catalog/package.json', wiredManifest);
        write('examples/catalog/tsconfig.json', buildConfig);
        write(
          'examples/catalog/tsconfig.test.json',
          JSON.stringify({ include: ['test/**/*.test.tsx'], exclude: ['node_modules', 'dist'] }, null, 2),
        );
        write('examples/catalog/test/smoke.test.tsx', A_TEST);
      },
      ({ errors }) => {
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('must set "noEmit": true');
      },
    );
  });

  it('still reports a test project that "type-check" never runs (objectui#3009)', () => {
    withWorkspace(
      (write) => {
        write('examples/catalog/package.json', manifest('@fixture/catalog', 'tsc --noEmit'));
        write('examples/catalog/tsconfig.json', buildConfig);
        write(
          'examples/catalog/tsconfig.test.json',
          JSON.stringify({ compilerOptions: { noEmit: true }, include: ['test/**/*.test.tsx'], exclude: [] }, null, 2),
        );
        write('examples/catalog/test/smoke.test.tsx', A_TEST);
      },
      ({ errors }) => {
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('never runs');
      },
    );
  });

  it('refuses to guess when a tsconfig cannot be parsed', () => {
    withWorkspace(
      (write) => {
        write('examples/catalog/package.json', manifest('@fixture/catalog', 'tsc --noEmit'));
        write('examples/catalog/tsconfig.json', '{ "include": ["src/**/*"], oops }\n');
        write('examples/catalog/test/smoke.test.tsx', A_TEST);
      },
      ({ errors }) => {
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('cannot parse tsconfig.json');
      },
    );
  });
});

/**
 * objectui#4291 — section 5½, the narrow type-assertion project.
 *
 * It is a RESCUE HATCH: a package still in TEST_DEBT can compile the one file
 * whose whole value is compile-time assertions, instead of waiting for its whole
 * backlog (objectui#3181). Once the package graduates and its `tsconfig.test.json`
 * compiles everything, that project names a file which is already compiled — two
 * spellings of what gets checked, plus one extra `tsc` per `type-check` run.
 *
 * The section had no test coverage at all until this suite: the gate that keeps
 * the rescue hatch honest was itself unchecked, which is the same shape as the
 * defect it exists to report.
 */
describe('the narrow type-assertion project is scoped to packages still in debt', () => {
  const buildConfig = JSON.stringify({ include: ['src/**/*'], exclude: ['node_modules', 'dist', 'test'] }, null, 2);
  const narrowConfig = JSON.stringify(
    { compilerOptions: { noEmit: true }, include: ['test/pins.test.ts'] },
    null,
    2,
  );

  it('reports the narrow project as redundant once the full test project covers everything', () => {
    withWorkspace(
      (write) => {
        write(
          'examples/catalog/package.json',
          manifest('@fixture/catalog', 'tsc --noEmit && tsc -p tsconfig.typetests.json && tsc -p tsconfig.test.json'),
        );
        write('examples/catalog/tsconfig.json', buildConfig);
        write(
          'examples/catalog/tsconfig.test.json',
          JSON.stringify(
            {
              compilerOptions: { noEmit: true },
              include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
              exclude: [],
            },
            null,
            2,
          ),
        );
        write('examples/catalog/tsconfig.typetests.json', narrowConfig);
        write('examples/catalog/test/pins.test.ts', A_TEST);
      },
      ({ errors }) => {
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('is redundant');
        expect(errors[0]).toContain('objectui#4291');
      },
    );
  });

  it('still allows it while the package IS in debt — the rescue hatch it exists to be', () => {
    // No `tsconfig.test.json`: the build skips the tests and nothing else reads
    // them, which is the state a TEST_DEBT entry declares. The narrow project
    // rescuing one file is exactly right here, so section 5½ must stay quiet
    // about it — the only error is the undeclared gap, because this fixture runs
    // with an empty TEST_DEBT table.
    withWorkspace(
      (write) => {
        write(
          'examples/catalog/package.json',
          manifest('@fixture/catalog', 'tsc --noEmit && tsc -p tsconfig.typetests.json'),
        );
        write('examples/catalog/tsconfig.json', buildConfig);
        write('examples/catalog/tsconfig.typetests.json', narrowConfig);
        write('examples/catalog/test/pins.test.ts', A_TEST);
      },
      ({ errors }) => {
        expect(errors.some((e) => e.includes('is redundant'))).toBe(false);
        expect(errors.some((e) => e.includes('that no `tsc`'))).toBe(true);
      },
    );
  });

  it('keeps reporting a narrow project that "type-check" never runs (objectui#3181)', () => {
    // The pre-existing half of the section, pinned here for the first time: an
    // in-debt package whose narrow project is not chained is compiling nothing,
    // and the redundancy rule above must not swallow that message.
    withWorkspace(
      (write) => {
        write('examples/catalog/package.json', manifest('@fixture/catalog', 'tsc --noEmit'));
        write('examples/catalog/tsconfig.json', buildConfig);
        write('examples/catalog/tsconfig.typetests.json', narrowConfig);
        write('examples/catalog/test/pins.test.ts', A_TEST);
      },
      ({ errors }) => {
        expect(errors.some((e) => e.includes('never\n      runs'))).toBe(true);
      },
    );
  });
});

describe('every surviving narrow project is a package still in debt, in this repository', () => {
  const packages = collect(repoRoot);
  const withNarrow = packages.filter((p) => p.hasTypeTestsConfig);

  it('is a set this gate can see at all', () => {
    // Deliberately not a count — objectui#4291 retired six and the rest follow as
    // #4040 burns down. What matters is that some remain to be judged.
    expect(withNarrow.length).toBeGreaterThan(0);
  });

  it('holds each survivor to being genuinely unrescued elsewhere', () => {
    // The invariant objectui#4291 established: a narrow project is worth keeping
    // only where the full test project does not already compile the same file.
    // Graduate a package without deleting its narrow project and this goes red,
    // as does the gate itself.
    for (const pkg of withNarrow) {
      expect(testsCovered(pkg), `${pkg.name} type-checks its tests now — its narrow project is redundant`).toBe(
        false,
      );
      expect(pkg.chainsTypeTestsConfig, `${pkg.name} does not chain its narrow project`).toBe(true);
    }
  });

  it('pins every package whose narrow project has been retired as having none', () => {
    // Named rather than counted: each of these had its guard file proven covered
    // by `tsc -p tsconfig.test.json --listFiles`, and a provably-false `Assert`
    // appended to that file turned the FULL project red. A narrow project
    // reappearing on any of them is the redundancy coming back.
    const retired = [
      // objectui#4291, the six that had graduated by then.
      '@object-ui/auth',
      '@object-ui/plugin-chatbot',
      '@object-ui/plugin-detail',
      '@object-ui/plugin-form',
      '@object-ui/plugin-grid',
      '@object-ui/plugin-list',
      // objectui#4040 tranche 4 — retired in the same PR that graduated the
      // package, which is what #4291's ratchet now requires.
      '@object-ui/components',
      '@object-ui/react',
    ];
    for (const name of retired) {
      const pkg = packages.find((p) => p.name === name);
      expect(pkg, `${name} is not a workspace package any more`).toBeDefined();
      expect(pkg!.hasTypeTestsConfig, `${name} has a tsconfig.typetests.json again`).toBe(false);
      expect(pkg!.typeCheck, `${name} still chains a narrow project`).not.toContain('tsconfig.typetests.json');
      // The other half: retirement moved the coverage, it did not drop it.
      expect(testsCovered(pkg), `${name} no longer type-checks its tests`).toBe(true);
    }
  });
});

describe('examples/schema-catalog is wired up, in this repository', () => {
  const packages = collect(repoRoot);
  const pkg = packages.find((p) => p.name === '@object-ui/example-schema-catalog');

  it('is a package this gate can see at all', () => {
    expect(pkg).toBeDefined();
  });

  it('keeps its tests outside src/, where the src-only walk could not find them', () => {
    // Deliberately not a count: files come and go. What matters is that tests
    // exist, that they live outside `src/`, and that the walk finds them anyway.
    expect(pkg!.testFiles).toBeGreaterThan(0);
    expect(pkg!.testFilePaths.every((rel: string) => !rel.startsWith('src/'))).toBe(true);
  });

  it('does not compile them in its build program — and does compile them elsewhere', () => {
    // Both halves matter. The first is why a test project is needed at all (the
    // build emits `dist` from `src`); the second is the fix. Revert either the
    // `tsconfig.test.json` or the `type-check` chaining and this goes red.
    expect(pkg!.buildSkips.length).toBe(pkg!.testFiles);
    expect(pkg!.hasTestConfig).toBe(true);
    expect(pkg!.chainsTestConfig).toBe(true);
    expect(pkg!.testConfigSkips).toEqual([]);
    expect(testsCovered(pkg)).toBe(true);
  });

  it('lists every package whose tests live outside src/, and holds each one to arriving wired up', () => {
    // The premise the fix was scoped on (#3968). A second package adopting this
    // layout is fine — but it must arrive wired up, and this list is where the
    // next reader finds out.
    //
    // `@object-ui/example-console-starter` is that second package
    // (objectui#3528). Its vite-alias closure test lives in `test/` for the same
    // structural reason schema-catalog's do: that example's `tsconfig.json` IS
    // the app build (`tsc && vite build`, `include: ["src"]`), and a fork-ready
    // template should not hand the customer a test file inside the `src/` they
    // are meant to edit.
    const outsideSrc = packages
      .filter((p) => p.testFilePaths.some((rel: string) => !rel.startsWith('src/')))
      .map((p) => p.name)
      .sort();
    expect(outsideSrc).toEqual([
      '@object-ui/example-console-starter',
      '@object-ui/example-schema-catalog',
    ]);

    // "It must arrive wired up" is now enforced here rather than left to the
    // reader: appending a name above is not enough on its own, because a package
    // in this layout whose tests no `tsc` program reads is the exact hole #3968
    // was about.
    for (const name of outsideSrc) {
      const adopter = packages.find((p) => p.name === name)!;
      expect(adopter.hasTestConfig, `${name} has no tsconfig.test.json`).toBe(true);
      expect(adopter.chainsTestConfig, `${name} does not chain it off "type-check"`).toBe(true);
      expect(adopter.testConfigSkips, `${name}'s test project misses test files`).toEqual([]);
    }
  });
});
