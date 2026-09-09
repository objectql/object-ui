/**
 * The CLI's cancel and non-TTY paths, driven as a child process (objectui#8786).
 *
 * ## Why this file exists at all
 *
 * `src/index.ts` calls `program.parse()` at import time, so nothing can import
 * it. Every existing test in this package therefore stops at `buildPluginFiles`
 * — and that is precisely the gate objectui#8786 walked through. The regression
 * it reports lives in the code BETWEEN the prompts and that call: a cancelled
 * prompt made `prompts` return a short answers object, `licenseCopyrightHolder`
 * dereferenced `vars.author.trim()` on `undefined`, and the run died with a
 * `TypeError` AFTER `fs.mkdirpSync` had created the target directory — leaving
 * an empty `packages/plugin-NAME/` that made the obvious retry fail with
 * "Directory already exists". A `buildPluginFiles` test is green on both sides
 * of that defect, so it is not a control for it. ⇒ these tests run the built
 * bin.
 *
 * ## The two ways an answer goes missing, and the one rule
 *
 * A prompt can go unanswered because the user CANCELLED it, or because there is
 * no TTY to ask on. The published contract (`README.md`, and the objectui#8041
 * ruling — director batch #91) is one rule for both: **the unanswered question
 * takes the default the prompt offered, and the complete file set is still
 * written.** The plugin name is the sole exception, because it has no default.
 *
 * ## Driving it
 *
 * Cancelling only exists where there is something to cancel, so those cases
 * need a real terminal: `script(1)` allocates a pty, and Ctrl-C reaches
 * `prompts` as data because `prompts` puts the tty in raw mode. The non-TTY
 * cases are the opposite and need no pty at all — an ordinary pipe closed
 * without a byte in it IS the `< /dev/null` case.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, '../..');
const CLI_BIN = join(PKG_ROOT, 'dist/index.js');

/**
 * The environment for a build this test spawns (objectui#8598).
 *
 * Vitest sets `VITEST` in its worker and a child inherits it, which makes every
 * `packages/*` vite config refuse to load with a cwd that is not the repo root.
 * `scripts/__tests__/spawned-build-vitest-env-8598.test.ts` keeps every build
 * spawn in the test tree scrubbing it; see `BUILD_ENV` in
 * `packages/cli/src/__tests__/cli-bin.test.ts` for the full account.
 */
const BUILD_ENV: NodeJS.ProcessEnv = (() => {
  const env = { ...process.env };
  delete env.VITEST;
  return env;
})();

/** Ctrl-C — spelled, never written as a raw byte, so this file stays greppable. */
const CTRL_C = String.fromCharCode(3);
/** Enter, as a tty delivers it. */
const ENTER = '\r';
/** CSI sequences a pty echoes, stripped before any assertion reads the transcript. */
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[a-zA-Z]`, 'g');

/** Exactly what a scaffolded plugin contains — the ten files, on disk. */
const EXPECTED_FILES = [
  'LICENSE',
  'README.md',
  'package.json',
  'src/DemoImpl.test.tsx',
  'src/DemoImpl.tsx',
  'src/index.tsx',
  'src/types.ts',
  'tsconfig.json',
  'vite.config.ts',
  'vitest.setup.ts',
] as const;

interface Step {
  /** Text the CLI must have printed before this step sends anything. */
  readonly waitFor: string;
  readonly send: string;
}

interface Run {
  readonly code: number | null;
  readonly transcript: string;
  readonly stderr: string;
  /** Files under `packages/plugin-demo`, or `null` when the directory is absent. */
  readonly files: string[] | null;
  readonly manifest: Record<string, unknown> | null;
  readonly license: string | null;
}

function listFiles(dir: string): string[] {
  const found: string[] = [];
  const walk = (at: string, prefix = ''): void => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(at, entry.name), `${prefix}${entry.name}/`);
      else found.push(`${prefix}${entry.name}`);
    }
  };
  walk(dir);
  return found.sort();
}

/**
 * Run the built CLI in a scratch cwd and report what it left behind.
 *
 * `pty: true` puts it behind `script(1)`, which is the only way `process.stdin
 * .isTTY` is true for the child and therefore the only way a prompt exists to
 * cancel.
 */
function driveCli(args: string[], steps: Step[], opts: { pty: boolean }): Promise<Run> {
  return new Promise((resolvePromise, rejectPromise) => {
    const cwd = mkdtempSync(join(tmpdir(), 'create-plugin-8786-'));
    const command = [process.execPath, CLI_BIN, ...args].map((part) => `'${part}'`).join(' ');
    const child = opts.pty
      ? spawn('script', ['-qec', command, '/dev/null'], { cwd, stdio: 'pipe' })
      : spawn(process.execPath, [CLI_BIN, ...args], { cwd, stdio: 'pipe' });

    let transcript = '';
    let stderr = '';
    let pending = 0;
    let closedStdin = false;

    const advance = (): void => {
      while (pending < steps.length) {
        const step = steps[pending];
        if (!transcript.includes(step.waitFor)) return;
        pending += 1;
        child.stdin.write(step.send);
      }
      if (!closedStdin) {
        closedStdin = true;
        child.stdin.end();
      }
    };

    child.stdout.on('data', (chunk: Buffer) => {
      transcript += chunk.toString().replace(ANSI, '');
      advance();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', rejectPromise);
    // Steps whose `waitFor` is already satisfied (or a run with no steps at
    // all) must not wait for output that may never come.
    advance();

    child.on('close', (code) => {
      const dir = join(cwd, 'packages', 'plugin-demo');
      const files = existsSync(dir) ? listFiles(dir) : null;
      const manifest =
        files?.includes('package.json') === true
          ? (JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8')) as Record<string, unknown>)
          : null;
      const license = files?.includes('LICENSE') === true ? readFileSync(join(dir, 'LICENSE'), 'utf-8') : null;
      rmSync(cwd, { recursive: true, force: true });
      resolvePromise({ code, transcript, stderr, files, manifest, license });
    });
  });
}

describe('create-plugin CLI — cancelling and non-TTY runs (objectui#8786)', () => {
  beforeAll(() => {
    // Built UNCONDITIONALLY, not "if missing". These tests exist to pin what
    // `src/index.ts` does, so a `dist/` left over from an earlier revision
    // would let them pass while asserting about code nobody is shipping — the
    // exact class of false green this card is about.
    const built = spawnSync('pnpm', ['run', 'build'], {
      cwd: PKG_ROOT,
      encoding: 'utf-8',
      stdio: 'pipe',
      env: BUILD_ENV,
    });
    if (built.status !== 0 || !existsSync(CLI_BIN)) {
      throw new Error(
        `Failed to build @object-ui/create-plugin for tests.\n` +
          `Looked at: ${CLI_BIN}\nstdout: ${built.stdout}\nstderr: ${built.stderr}`,
      );
    }
  }, 180_000);

  describe('a cancelled prompt', () => {
    it('takes the defaults and writes the whole plugin when cancelled at Author', async () => {
      const run = await driveCli(
        ['demo'],
        [
          { waitFor: 'Plugin description:', send: ENTER },
          { waitFor: 'Author name:', send: CTRL_C },
        ],
        { pty: true },
      );

      // The regression, stated as the two things it did: it threw, and it left
      // a directory behind with nothing in it.
      expect(run.stderr).not.toContain('TypeError');
      expect(run.code).toBe(0);
      expect(run.files).toEqual([...EXPECTED_FILES]);
      expect(run.manifest?.license).toBe('MIT');
      // The author prompt's own default is the empty string, so the holder is
      // the package's authors rather than a copyright line trailing off after
      // the year.
      expect(run.license).toContain('the @object-ui/plugin-demo authors');
      expect(run.transcript).toContain('take their defaults');
    }, 60_000);

    it('takes the defaults and writes the whole plugin when cancelled at Description', async () => {
      const run = await driveCli(['demo'], [{ waitFor: 'Plugin description:', send: CTRL_C }], {
        pty: true,
      });

      expect(run.stderr).not.toContain('TypeError');
      expect(run.code).toBe(0);
      expect(run.files).toEqual([...EXPECTED_FILES]);
      expect(run.manifest?.description).toBe('Demo plugin for ObjectUI');
      expect(run.manifest?.license).toBe('MIT');
    }, 60_000);

    it('still yields MIT and ten files when cancelled at License', async () => {
      // ⭐ THE CONTROL. This case was already correct before objectui#8786 —
      // cancelling the LAST question leaves nothing unanswered that anything
      // dereferences. It is here to fail if the repair "fixed" the cancel path
      // by changing what a cancel produces, rather than by making the two
      // earlier cancels behave like this one always did.
      const run = await driveCli(
        ['demo'],
        [
          { waitFor: 'Plugin description:', send: ENTER },
          { waitFor: 'Author name:', send: `Ada${ENTER}` },
          { waitFor: 'License:', send: CTRL_C },
        ],
        { pty: true },
      );

      expect(run.code).toBe(0);
      expect(run.files).toEqual([...EXPECTED_FILES]);
      expect(run.manifest?.license).toBe('MIT');
      expect(run.license).toContain('Ada');
    }, 60_000);
  });

  describe('an answered run', () => {
    it('asks the four questions in the published order and writes what it was told', async () => {
      const run = await driveCli(
        ['demo'],
        [
          { waitFor: 'Plugin description:', send: `A heat map${ENTER}` },
          { waitFor: 'Author name:', send: `Ada${ENTER}` },
          { waitFor: 'License:', send: ENTER },
        ],
        { pty: true },
      );

      expect(run.code).toBe(0);
      expect(run.files).toEqual([...EXPECTED_FILES]);
      expect(run.manifest?.description).toBe('A heat map');
      expect(run.manifest?.license).toBe('MIT');
      expect(run.license).toContain('Ada');

      // Prompt ORDER is published behaviour (the objectui#8041 ruling names the
      // licence question as the fourth). Asserted on the transcript rather than
      // on the questions array, so it is the shipped bin that is pinned.
      const order = ['Plugin description:', 'Author name:', 'License:'].map((message) =>
        run.transcript.indexOf(message),
      );
      expect(order.every((at) => at >= 0)).toBe(true);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    }, 60_000);
  });

  describe('a run with no TTY', () => {
    it('takes every default and writes the whole plugin, as the README promises', async () => {
      // An ordinary pipe closed with nothing in it. Before objectui#8786 this
      // exact run printed the first question, wrote NOTHING, and exited 0 in
      // silence — while README.md and the pending changeset both said it takes
      // MIT and still writes the text.
      const run = await driveCli(['demo'], [], { pty: false });

      expect(run.code).toBe(0);
      expect(run.files).toEqual([...EXPECTED_FILES]);
      expect(run.manifest?.license).toBe('MIT');
      expect(run.license).toContain('MIT License');
      expect(run.transcript).toContain('No TTY on stdin');
    }, 60_000);

    it('writes the LICENSE holder from --author', async () => {
      const run = await driveCli(['demo', '--author', 'Ada Lovelace'], [], { pty: false });

      expect(run.code).toBe(0);
      expect(run.license).toContain('Ada Lovelace');
    }, 60_000);

    it('refuses without a plugin name, and creates nothing', async () => {
      // The one answer with no default. It is also the one case where a run
      // that cannot ask must not scaffold — and it used to exit 0 in silence.
      const run = await driveCli([], [], { pty: false });

      expect(run.code).toBe(1);
      expect(run.transcript).toContain('Plugin name is required');
      expect(run.files).toBeNull();
    }, 60_000);
  });
});
