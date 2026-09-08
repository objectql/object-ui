import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');

/**
 * A build a TEST spawns must not inherit `VITEST` (objectui#8598).
 *
 * ## The defect this closes, and why it needs a gate rather than a comment
 *
 * Vitest sets `VITEST=true` in its worker, and a child process inherits the
 * worker's environment. All 24 `packages/*` vite configs open with
 * `if (process.env.VITEST) { assertCanonicalVitestInvocation(...) }`, and that
 * guard derives its "vitest root" from `cwd` when argv carries no `--root`. So
 * a build spawned as `pnpm --filter PKG run build` — cwd = the package
 * directory — is read as a vitest run launched from the wrong place, and the
 * guard calls `process.exit(1)` before the bundler starts.
 *
 * ⚠️ It is invisible until two independent things line up: a test that spawns a
 * build, and a target package whose build loads a vite config. objectui#8598
 * created the second half by giving `@object-ui/types` a `vite build` step, and
 * `Test (shard 2/4)` went red in CI on a diff that touched no test at all. The
 * build script is correct in isolation, the spawning test is correct in
 * isolation, and the guard is correct in isolation — nothing but their
 * intersection is wrong, which is exactly the shape no reviewer of one file
 * catches.
 *
 * ## Why HERE, and not in the configs
 *
 * ⛔ The alternative repair — teach one config to gate on vite's `command`
 * instead of the variable — was rejected twice over. It diverges 1 of 24
 * otherwise byte-identical guard blocks, and
 * `scripts/__tests__/vitest-invocation-guard.test.ts` mechanically REFUSES that
 * divergence: its "gates that call on VITEST" case requires the literal
 * `if (process.env.VITEST) {` + `assertCanonicalVitestInvocation(` shape in
 * every `packages/*` vite config. ⭐ And that ratchet's own name states the
 * property being violated — "gates that call on VITEST, so `vite build` is never
 * refused". The leak falsifies it from OUTSIDE, where no config can see it, so
 * the repair belongs at the spawn: the only place that knows its child is a
 * build and not a test run.
 *
 * ## What is asserted
 *
 *  1. The population is derived from the tree, never listed — a hand-copied
 *     enumeration drifts toward checking fewer call sites.
 *  2. It has a FLOOR and a named member, so a walk that resolves nothing goes
 *     red instead of green. That is the one failure a ratchet cannot notice
 *     about itself.
 *  3. Spawns are found by AST, not by substring: `toContain('VITEST')` is
 *     satisfied by the word appearing in a comment, which is precisely the shape
 *     of a call site somebody explained instead of fixing.
 */

/** Node child-process entry points that start a program. */
const SPAWNERS = new Set(['spawnSync', 'spawn', 'execFileSync', 'execFile', 'execSync', 'exec']);

/** Test files anywhere in the workspace — the only files this gate judges. */
function testFiles(): string[] {
  const found: string[] = [];
  const skip = new Set(['node_modules', 'dist', 'build', 'coverage', '.turbo', '.next', '.git']);
  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (skip.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(test|spec)\.tsx?$/.test(entry.name)) found.push(path.relative(ROOT, full));
    }
  };
  for (const top of ['packages', 'apps', 'scripts', 'examples']) walk(path.join(ROOT, top));
  return found.sort();
}

interface BuildSpawn {
  readonly file: string;
  readonly line: number;
  /**
   * Text of the `env:` value passed in the options object, if any — with an
   * IDENTIFIER resolved to its declaration in the same file.
   *
   * ⚠️ Resolving is the difference between this gate working and this gate
   * looking like it works. The fix it exists to enforce is naturally written as
   * a named constant (`env: BUILD_ENV`), and the text of that property contains
   * no `VITEST` at all — so a gate reading the property alone reports the FIXED
   * tree as leaking. Measured: it did, on both call sites, before this resolved.
   * ⛔ The resolution is also deliberately narrow — the declaration of that one
   * name, never the whole file — because a file-wide substring search passes on
   * any mention of `VITEST` anywhere, including a comment about it.
   */
  readonly env: string | null;
}

/** The initializer text of a `const`/`let` named `name` in this file, if there is one. */
function declarationText(source: ts.SourceFile, name: string): string | null {
  let text: string | null = null;
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer !== undefined
    ) {
      text = node.initializer.getText(source);
    }
    node.forEachChild(visit);
  };
  visit(source);
  return text;
}

/** Every call in `file` that starts a child process running a `build` script. */
function buildSpawns(file: string): BuildSpawn[] {
  const abs = path.join(ROOT, file);
  const text = fs.readFileSync(abs, 'utf8');
  // Cheap pre-filter, then AST. Every judgement below is made on the AST.
  if (!text.includes('build')) return [];

  const source = ts.createSourceFile(abs, text, ts.ScriptTarget.Latest, true);
  const found: BuildSpawn[] = [];

  const namesABuild = (node: ts.CallExpression): boolean =>
    node.arguments.some((arg) => {
      if (ts.isStringLiteralLike(arg)) return /(^|\s)build(\s|$)/.test(arg.text);
      if (ts.isArrayLiteralExpression(arg)) {
        return arg.elements.some((el) => ts.isStringLiteralLike(el) && el.text === 'build');
      }
      return false;
    });

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = ts.isPropertyAccessExpression(node.expression)
        ? node.expression.name.text
        : ts.isIdentifier(node.expression)
          ? node.expression.text
          : '';
      if (SPAWNERS.has(callee) && namesABuild(node)) {
        const options = node.arguments.find(ts.isObjectLiteralExpression.bind(ts));
        let env: string | null = null;
        if (options !== undefined) {
          for (const property of options.properties) {
            const key =
              property.name !== undefined && ts.isIdentifier(property.name) ? property.name.text : '';
            if (key !== 'env' || !ts.isPropertyAssignment(property)) continue;
            const value = property.initializer;
            env = ts.isIdentifier(value)
              ? (declarationText(source, value.text) ?? value.getText(source))
              : value.getText(source);
          }
        }
        found.push({
          file,
          line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
          env,
        });
      }
    }
    node.forEachChild(visit);
  };
  visit(source);
  return found;
}

const SPAWNS = testFiles().flatMap(buildSpawns);

/**
 * The floor, plus a named member.
 *
 * Two build spawns exist today, both in `cli-bin.test.ts`. The floor is set at
 * 1 rather than 2 on purpose: it is a vacuity guard, not a second copy of the
 * count, so retiring one spawn stays an ordinary green change while a walk that
 * resolves nothing does not.
 */
const POPULATION_FLOOR = 1;
const NAMED_MEMBER = 'packages/cli/src/__tests__/cli-bin.test.ts';

describe(`objectui#8598 — ${SPAWNS.length} build spawn(s) in the test tree`, () => {
  it(`finds a real population: floor ${POPULATION_FLOOR}, and ${NAMED_MEMBER}`, () => {
    expect(SPAWNS.length).toBeGreaterThanOrEqual(POPULATION_FLOOR);
    expect(SPAWNS.map((s) => s.file)).toContain(NAMED_MEMBER);
  });

  it('every one of them scrubs VITEST from the child environment', () => {
    const leaking = SPAWNS.filter((s) => s.env === null || !s.env.includes('VITEST')).map(
      (s) => `${s.file}:${s.line}`,
    );

    expect(
      leaking,
      'These start a BUILD from inside a vitest worker without removing `VITEST` from the ' +
        "child's environment. Every packages/* vite config refuses to load when it sees that " +
        'variable with a cwd that is not the repo root, so the build exits 1 before the bundler ' +
        'runs and the test reports a build failure it did not cause (objectui#8598, ' +
        '`Test (shard 2/4)`). Pass an env with `VITEST` deleted — see `BUILD_ENV` in ' +
        `${NAMED_MEMBER}:\n  ` + leaking.join('\n  '),
    ).toEqual([]);
  });
});
