/**
 * Smoke tests for the @object-ui/cli bin.
 *
 * These tests invoke the built `dist/cli.js` as a child process to verify
 * that the public CLI surface (commands, flags, exit codes) matches what
 * is documented in the README and content/docs/utilities/cli.mdx.
 *
 * If you change a flag or command name, update both this test file AND the
 * docs in the same PR (Rule #2: Documentation Driven Development).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_BIN = resolve(__dirname, '../../dist/cli.js');
const PKG_PATH = resolve(__dirname, '../../package.json');

const SUBCOMMANDS = [
  'serve',
  'dev',
  'build',
  'start',
  'init',
  'lint',
  'test',
  'generate',
  'doctor',
  'add',
  'studio',
  'check',
  'validate',
  'create',
  'analyze',
] as const;

function run(args: string[], opts: { cwd?: string } = {}) {
  const res = spawnSync('node', [CLI_BIN, ...args], {
    cwd: opts.cwd ?? process.cwd(),
    encoding: 'utf-8',
  });
  return {
    code: res.status ?? -1,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
  };
}

describe('@object-ui/cli bin', () => {
  beforeAll(() => {
    // The CLI bin imports @object-ui/types/zod at runtime (validate command),
    // so both the CLI bundle AND the types package must be built before we
    // invoke `dist/cli.js` as a child process. `pnpm test:coverage` (root
    // vitest) does NOT trigger turbo's `^build` deps, so we self-build here
    // to keep the test runnable from any entry point (CI coverage, CI turbo,
    // local watch, fresh clone).
    const TYPES_ZOD = resolve(
      __dirname,
      '../../../types/dist/zod/index.zod.js',
    );
    const repoRoot = resolve(__dirname, '../../../..');

    if (!existsSync(TYPES_ZOD)) {
      const result = spawnSync(
        'pnpm',
        ['--filter', '@object-ui/types', 'run', 'build'],
        { cwd: repoRoot, encoding: 'utf-8', stdio: 'pipe' },
      );
      if (result.status !== 0 || !existsSync(TYPES_ZOD)) {
        throw new Error(
          `Failed to build @object-ui/types for tests.\n` +
            `Looked at: ${TYPES_ZOD}\n` +
            `stdout: ${result.stdout}\nstderr: ${result.stderr}`,
        );
      }
    }

    if (!existsSync(CLI_BIN)) {
      const pkgRoot = resolve(__dirname, '../..');
      const result = spawnSync('pnpm', ['run', 'build'], {
        cwd: pkgRoot,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      if (result.status !== 0 || !existsSync(CLI_BIN)) {
        throw new Error(
          `Failed to build @object-ui/cli for tests.\n` +
            `Looked at: ${CLI_BIN}\n` +
            `stdout: ${result.stdout}\nstderr: ${result.stderr}`,
        );
      }
    }
  }, 180_000);

  describe('package metadata', () => {
    it('package.json declares the standalone @object-ui/cli identity', () => {
      const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
      expect(pkg.name).toBe('@object-ui/cli');
      expect(pkg.bin).toEqual({ objectui: './dist/cli.js' });
      expect(pkg.oclif).toBeUndefined();
      expect(pkg.dependencies?.['@oclif/core']).toBeUndefined();
    });
  });

  describe('--version', () => {
    it('matches the version in package.json', () => {
      const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
      const res = run(['--version']);
      expect(res.code).toBe(0);
      expect(res.stdout.trim()).toBe(pkg.version);
    });
  });

  describe('--help', () => {
    it('lists all 15 documented commands', () => {
      const res = run(['--help']);
      expect(res.code).toBe(0);
      const out = res.stdout;
      for (const cmd of SUBCOMMANDS) {
        expect(out, `command "${cmd}" should appear in --help output`).toContain(cmd);
      }
    });

    it('uses the "objectui" bin name (not "os ui")', () => {
      const res = run(['--help']);
      expect(res.stdout).toMatch(/Usage:\s+objectui/);
      expect(res.stdout).not.toContain('os ui');
    });
  });

  describe.each(SUBCOMMANDS)('subcommand "%s"', (cmd) => {
    it('exits 0 on --help', () => {
      const res = run([cmd, '--help']);
      expect(res.code, res.stderr || res.stdout).toBe(0);
      expect(res.stdout).toContain(`objectui ${cmd}`);
    });
  });

  describe('flag contracts (locked-in by docs)', () => {
    const cases: Array<[string, RegExp[]]> = [
      ['dev',      [/-p, --port <port>/, /-h, --host <host>/, /--no-open/]],
      ['serve',    [/-p, --port <port>/, /-h, --host <host>/]],
      ['build',    [/-o, --out-dir <dir>/, /--clean/]],
      ['start',    [/-p, --port <port>/, /-h, --host <host>/, /-d, --dir <dir>/]],
      ['init',     [/-t, --template <template>/]],
      ['lint',     [/--fix/]],
      ['test',     [/-w, --watch/, /-c, --coverage/, /--ui/]],
      ['generate', [/--from <source>/, /--output <dir>/]],
      ['analyze',  [/--bundle-size/, /--render-performance/]],
      ['validate', [/\[schema\]/]],
    ];
    it.each(cases)('%s exposes the documented flags', (cmd, patterns) => {
      const res = run([cmd, '--help']);
      expect(res.code).toBe(0);
      for (const re of patterns) {
        expect(res.stdout).toMatch(re);
      }
    });
  });

  describe('validate', () => {
    let work: string;
    beforeAll(() => {
      work = mkdtempSync(join(tmpdir(), 'objectui-cli-validate-'));
      writeFileSync(
        join(work, 'good.json'),
        JSON.stringify({
          type: 'div',
          className: 'p-4',
          body: { type: 'text', content: 'ok' },
        }),
      );
      writeFileSync(join(work, 'bad.json'), JSON.stringify({ no_type_field: true }));
    });

    it('exits 0 for a valid schema', () => {
      const res = run(['validate', 'good.json'], { cwd: work });
      expect(res.code, res.stdout + res.stderr).toBe(0);
      expect(res.stdout).toMatch(/Schema is valid/i);
    });

    it('exits non-zero for an invalid schema', () => {
      const res = run(['validate', 'bad.json'], { cwd: work });
      expect(res.code).not.toBe(0);
    });

    it('exits non-zero when the file is missing', () => {
      const res = run(['validate', 'does-not-exist.json'], { cwd: work });
      expect(res.code).not.toBe(0);
      expect(res.stdout + res.stderr).toMatch(/not found/i);
    });
  });

  describe('init', () => {
    let work: string;
    let appDir: string;
    // Scaffolded once in `beforeAll` rather than by the first `it`, so the
    // assertions below do not silently depend on test ordering (objectui#3892
    // added three of them to what was a single self-contained case).
    beforeAll(() => {
      work = mkdtempSync(join(tmpdir(), 'objectui-cli-init-'));
      appDir = join(work, 'sample-app');
      const res = run(['init', 'sample-app', '-t', 'simple'], { cwd: work });
      expect(res.code, res.stdout + res.stderr).toBe(0);
    });

    it('scaffolds a project with the simple template', () => {
      for (const f of [
        'app.json',
        'package.json',
        'index.html',
        'vite.config.ts',
        'tsconfig.json',
        'src/App.tsx',
        'src/main.tsx',
        'src/index.css',
      ]) {
        expect(existsSync(join(appDir, f)), `expected ${f} to exist`).toBe(true);
      }
      const schema = JSON.parse(readFileSync(join(appDir, 'app.json'), 'utf-8'));
      expect(schema).toHaveProperty('type');
    });

    it('writes no tailwind.config.js, because v4 would never read it', () => {
      // objectui#3892, mirroring what objectui#3852 did for the temp-app
      // generators. The scaffold's pipeline is Tailwind 4 end to end
      // (`@tailwindcss/postcss` in `postcss.config.js`, `@import 'tailwindcss'`
      // in `src/index.css`), and v4 reads a JS config only when a stylesheet
      // points `@config` at it. The file this used to write was inert: an
      // authoritative-looking `content` list nothing consumed.
      //
      // Asserted through the real bin rather than over a file map, because
      // `init()` writes with `fs` directly — an absence is only meaningful
      // where the writes actually happen.
      expect(existsSync(join(appDir, 'tailwind.config.js'))).toBe(false);
      expect(existsSync(join(appDir, 'tailwind.config.ts'))).toBe(false);
      expect(readFileSync(join(appDir, 'src/index.css'), 'utf-8')).not.toContain('@config');
      // The v4 pipeline it is inert *relative to*, so the absence above cannot
      // be read as "this scaffold is not on Tailwind at all".
      expect(readFileSync(join(appDir, 'postcss.config.js'), 'utf-8')).toContain(
        `'@tailwindcss/postcss': {}`
      );
      expect(readFileSync(join(appDir, 'src/index.css'), 'utf-8')).toContain(
        `@import 'tailwindcss';`
      );
    });

    it('versions the scaffold against the CLI that wrote it, not a literal', () => {
      // objectui#3892's reported defect, gated where the user meets it: the
      // manifest asked for `@object-ui/*` at `^2.0.0` while the CLI and every
      // platform package publish at 17.x from one `fixed` changeset group, so
      // `npm install` in a fresh scaffold resolved a major unrelated to the CLI
      // that produced it.
      //
      // `app-generator.test.ts` anchors `buildInitPackageJson`'s ranges; this
      // asserts `init()` actually WRITES that manifest, which is the half a
      // unit test on the builder cannot see.
      const cliVersion = JSON.parse(readFileSync(PKG_PATH, 'utf-8')).version as string;
      const manifest = JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf-8')) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };

      expect(manifest.dependencies['@object-ui/react']).toBe(`^${cliVersion}`);
      expect(manifest.dependencies['@object-ui/components']).toBe(`^${cliVersion}`);
      expect(manifest.dependencies['@object-ui/react']).not.toBe('^2.0.0');
      // A spot check that the toolchain half is written too — the full anchor
      // judgement lives in `app-generator.test.ts`.
      expect(manifest.devDependencies.vite).not.toBe('^7.3.1');
    });
  });
});
