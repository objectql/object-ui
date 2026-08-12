import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Plain-JS CI helper. Its types are INFERRED from the .mjs source by
// `tsconfig.scripts.json` (`allowJs`), so no `@ts-expect-error` here —
// re-adding one is now itself an error (TS2578). See objectui#3494.
import { classify, scan, locate, SCANNED_BYTES, KNOWN_OFFENDERS } from '../check-control-bytes.mjs';

/**
 * objectstack#5425. Two raw U+0000 bytes in
 * `packages/app-shell/src/views/metadata-admin/inspectors/useDatasetFields.ts`
 * made the whole file binary to grep, so a content search for anything in it
 * returned nothing at all — and objectui had no gate that could ever have said
 * so. `scripts/check-control-bytes.mjs` is that gate; this is its test.
 *
 * ## Byte discipline
 *
 * Every control byte below is produced from a NUMBER (`Buffer.from([0x00])`).
 * None is written as a literal, and none is written as a backslash escape: an
 * escape typed into an agent's tool payload is decoded into the real byte
 * before it reaches disk, which is exactly how objectstack#4763 and #4890
 * happened — both while their author was writing the rule forbidding it. This
 * file is inside the gate's own scan scope, so a slip here turns the suite red
 * on itself, which is the intended safety net.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** A one-byte buffer, built from a number — never a literal. */
const byte = (n: number) => Buffer.from([n]);

const NUL = 0x00;
const SOH = 0x01; // the byte objectstack#5140 shipped alongside a NUL (#5157)
const TAB = 0x09;
const LF = 0x0a;
const CR = 0x0d;
const DEL = 0x7f;

/** Builds a throwaway git repo and runs the REAL `scan()` over it. */
function withTempRepo<T>(build: (write: (rel: string, contents: Buffer | string) => void, dir: string) => void, run: (dir: string) => T): T {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-control-bytes-'));
  const write = (rel: string, contents: Buffer | string) => {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents);
  };
  try {
    execFileSync('git', ['init', '-q'], { cwd: dir });
    build(write, dir);
    execFileSync('git', ['add', '-A', '-f'], { cwd: dir });
    return run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('classify — text or binary, judged by content alone', () => {
  it('never lets a control byte be its own alibi', () => {
    // The circularity this guard exists to break: "the file has a NUL, therefore
    // it is binary, therefore we do not check it for NULs" is what git does.
    expect(classify(Buffer.concat([Buffer.from('plain text'), byte(NUL)]))).toBe('text');
    expect(classify(Buffer.concat([Buffer.from('plain text'), byte(SOH)]))).toBe('text');
  });

  it('calls genuinely invalid UTF-8 binary', () => {
    expect(classify(Buffer.from([0xc0, 0x80, 0x41, 0xf8]))).toBe('binary');
  });

  it('treats an empty file as text', () => {
    expect(classify(Buffer.from(''))).toBe('text');
  });

  it('leaves UTF-16/UTF-32 alone — their NULs are structural, not a defect', () => {
    expect(classify(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('hi', 'utf16le')]))).toBe('wide-encoding');
    expect(classify(Buffer.from([0x00, 0x00, 0xfe, 0xff, 0x00, 0x41]))).toBe('wide-encoding');
  });

  it('does not misread a long multi-byte UTF-8 file as binary', () => {
    // A leading-window probe truncates a multi-byte character and calls the file
    // binary; the decode must read the whole buffer.
    expect(classify(Buffer.from(`# Long\n\n${'中文段落,用于跨越任何前缀窗口。'.repeat(4000)}\n`))).toBe('text');
  });
});

describe('SCANNED_BYTES — the covered set', () => {
  it('covers the C0 range apart from tab, line feed and carriage return', () => {
    for (let b = 0x00; b <= 0x1f; b++) {
      const structural = b === TAB || b === LF || b === CR;
      expect(SCANNED_BYTES.has(b), `${b.toString(16)} structural=${structural}`).toBe(!structural);
    }
  });

  it('covers U+007F and nothing printable', () => {
    expect(SCANNED_BYTES.has(DEL)).toBe(true);
    for (const b of [0x20, 0x41, 0x7e]) expect(SCANNED_BYTES.has(b)).toBe(false);
  });

  it('goes beyond U+0000 — the objectstack#5157 lesson', () => {
    // #5140 shipped a NUL and a U+0001 fourteen bytes apart; the NUL-only
    // scanner reported OK on the second. A gate that only knows about U+0000
    // reproduces that miss by construction.
    expect(SCANNED_BYTES.has(NUL)).toBe(true);
    expect(SCANNED_BYTES.has(SOH)).toBe(true);
  });
});

describe('scan — what gets flagged', () => {
  it('flags control bytes by carrier, not by file extension', () => {
    const { offenders } = withTempRepo(
      (write) => {
        // The original case: a NUL in a TS source.
        write('packages/x/src/protocol.ts', Buffer.concat([Buffer.from("const sep = '"), byte(NUL), Buffer.from("';\n")]));
        // objectstack#4890: agent instructions under `.claude/`, markdown, and
        // the byte sits well past git's 8000-byte binary sniff window.
        write(
          '.claude/skills/demo/SKILL.md',
          Buffer.concat([Buffer.from(`# Demo skill\n\n${'filler prose. '.repeat(700)}\nsep: `), byte(NUL), Buffer.from('\n')]),
        );
        // An extension nobody has seen before must still be scanned — that is
        // the property an allow-list cannot have.
        write('config/weird.frobnicate', Buffer.concat([Buffer.from('key='), byte(NUL), Buffer.from('\n')]));
        // A YAML workflow, same reasoning.
        write('.github/workflows/ci.yml', Buffer.concat([Buffer.from('name: ci # '), byte(SOH), Buffer.from('\n')]));
      },
      (dir) => scan(dir, new Map()),
    );

    expect(offenders.map((o: { file: string }) => o.file).sort()).toEqual([
      '.claude/skills/demo/SKILL.md',
      '.github/workflows/ci.yml',
      'config/weird.frobnicate',
      'packages/x/src/protocol.ts',
    ]);
  });

  it('reports which byte it found, not just that something was wrong', () => {
    const { offenders } = withTempRepo(
      (write) => {
        write('a.ts', Buffer.concat([Buffer.from('const a = 1;'), byte(SOH), Buffer.from('\n')]));
      },
      (dir) => scan(dir, new Map()),
    );
    // The two classes carry different harms, so the report must distinguish them.
    expect(offenders[0].bytes).toEqual([SOH]);
    expect(offenders[0].bytes).not.toContain(NUL);
  });

  it('leaves clean text of every shape green, tabs and CRLF included', () => {
    const { offenders, scanned } = withTempRepo(
      (write) => {
        write('docs/clean.md', '# Clean\n\n中文说明,带 emoji 🚀 —— 完全合法的 UTF-8。\n');
        write('src/tabs.ts', Buffer.concat([Buffer.from('function f() {'), byte(TAB), Buffer.from('return 1; }\n')]));
        write('src/crlf.ts', Buffer.concat([Buffer.from('const a = 1;'), byte(CR), byte(LF)]));
        write('.github/workflows/ci.yml', 'name: ci\non: [push]\n');
      },
      (dir) => scan(dir, new Map()),
    );
    expect(offenders).toEqual([]);
    expect(scanned).toBe(4);
  });

  it('skips real binary assets, wide encodings, dangling symlinks and build output', () => {
    const { offenders, skipped } = withTempRepo(
      (write, dir) => {
        write('assets/pic.png', Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), byte(NUL), Buffer.from([0xff, 0xd8, 0xc0, 0x80])]));
        write('docs/utf16.txt', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('hi', 'utf16le')]));
        write('packages/x/dist/bundle.js', Buffer.concat([Buffer.from('var a='), byte(NUL), Buffer.from(';\n')]));
        fs.symlinkSync('/nonexistent/target', path.join(dir, 'dangling'));
      },
      (dir) => scan(dir, new Map()),
    );
    expect(offenders).toEqual([]);
    expect(skipped.binary).toEqual(['assets/pic.png']);
    expect(skipped['wide-encoding']).toEqual(['docs/utf16.txt']);
    expect(skipped.unreadable).toEqual(['dangling']);
  });

  it('locates a byte past git’s 8000-byte sniff window', () => {
    const { offenders } = withTempRepo(
      (write) => {
        write('long.md', Buffer.concat([Buffer.from(`# Long\n\n${'filler prose. '.repeat(700)}\nsep: `), byte(NUL), Buffer.from('\n')]));
      },
      (dir) => scan(dir, new Map()),
    );
    expect(offenders[0].offset).toBeGreaterThan(8000);
    expect(offenders[0].line).toBe(4);
    expect(offenders[0].column).toBe(6);
  });

  it('counts every occurrence, not just the first', () => {
    const { offenders } = withTempRepo(
      (write) => {
        write('a.ts', Buffer.concat([Buffer.from('a'), byte(NUL), Buffer.from('b'), byte(NUL), Buffer.from('c\n')]));
      },
      (dir) => scan(dir, new Map()),
    );
    expect(offenders[0].count).toBe(2);
  });
});

describe('locate — byte offset to line:column', () => {
  it('counts lines from 1 and columns in characters, not bytes', () => {
    const buf = Buffer.from('one\n中文x');
    expect(locate(buf, buf.indexOf(0x78))).toEqual({ line: 2, column: 3 });
  });
});

describe('scan — the KNOWN_OFFENDERS baseline is a ratchet, not a skip-list', () => {
  const baselineFor = (file: string, bytes: number[]) => new Map([[file, { bytes, issue: 'objectstack#5450' }]]);

  it('lets a declared pre-existing offender through without hiding it', () => {
    const { offenders, baselined } = withTempRepo(
      (write) => write('legacy.ts', Buffer.concat([Buffer.from('const s = "'), byte(NUL), Buffer.from('";\n')])),
      (dir) => scan(dir, baselineFor('legacy.ts', [NUL])),
    );
    expect(offenders).toEqual([]);
    // Still reported, with its issue — baselined is not the same as invisible.
    expect(baselined).toHaveLength(1);
    expect(baselined[0].file).toBe('legacy.ts');
    expect(baselined[0].issue).toBe('objectstack#5450');
  });

  it('does NOT license a byte the entry never declared', () => {
    // One entry must not become blanket permission for the whole file — a file
    // that gains a new kind of control byte is a new defect.
    const { offenders } = withTempRepo(
      (write) => write('legacy.ts', Buffer.concat([Buffer.from('const s = "'), byte(NUL), byte(SOH), Buffer.from('";\n')])),
      (dir) => scan(dir, baselineFor('legacy.ts', [NUL])),
    );
    expect(offenders).toHaveLength(1);
    expect(offenders[0].bytes).toEqual([NUL, SOH]);
  });

  it('goes red when a baselined file has been cleaned', () => {
    // Without this, the map degrades into a permanent skip-list nobody dares
    // delete from, because nobody knows which entries still apply.
    const { stale, offenders } = withTempRepo(
      (write) => write('legacy.ts', 'const s = "clean";\n'),
      (dir) => scan(dir, baselineFor('legacy.ts', [NUL])),
    );
    expect(offenders).toEqual([]);
    expect(stale).toEqual(['legacy.ts']);
  });

  it('goes red when a baselined file no longer exists', () => {
    const { stale } = withTempRepo(
      (write) => write('other.ts', 'const s = 1;\n'),
      (dir) => scan(dir, baselineFor('deleted.ts', [NUL])),
    );
    expect(stale).toEqual(['deleted.ts']);
  });
});

describe('repo state — the gate is green on this tree', () => {
  const result = scan(repoRoot);

  it('has no un-baselined control byte anywhere in the tree', () => {
    expect(
      result.offenders.map((o: { file: string; line: number; bytes: number[] }) => `${o.file}:${o.line}`),
      'Run `pnpm check:control-bytes` for the full report and the fix guidance.',
    ).toEqual([]);
  });

  it('has no stale baseline entries', () => {
    expect(
      result.stale,
      'These files are listed in KNOWN_OFFENDERS but are now clean — delete their entries.',
    ).toEqual([]);
  });

  it('actually scanned the tree rather than silently matching nothing', () => {
    // A scan that finds no files would pass both assertions above for the wrong
    // reason — the empty-verdict trap.
    expect(result.scanned).toBeGreaterThan(1000);
  });

  it('keeps every baseline entry attached to an issue', () => {
    for (const [file, entry] of KNOWN_OFFENDERS as Map<string, { bytes: number[]; issue: string }>) {
      expect(entry.issue, `KNOWN_OFFENDERS[${file}] must name the issue tracking its removal`).toMatch(/#\d+/);
      expect(entry.bytes.length, `KNOWN_OFFENDERS[${file}] must declare which bytes it covers`).toBeGreaterThan(0);
    }
  });
});

describe('objectstack#5425 — the file that started this is readable again', () => {
  const target = 'packages/app-shell/src/views/metadata-admin/inspectors/useDatasetFields.ts';

  it('carries no control byte at all', () => {
    const buf = fs.readFileSync(path.join(repoRoot, target));
    const found = [...buf].filter((b) => SCANNED_BYTES.has(b));
    expect(found).toEqual([]);
  });

  it('is visible to a content search — the harm the issue actually reported', () => {
    // The regression this pins is not "the byte is gone", it is "grep can see
    // the file". grep exits 0 and prints the line; before the fix it printed
    // `binary file matches` and no line at all.
    const out = execFileSync('grep', ['-n', 'includeKey', target], { cwd: repoRoot, encoding: 'utf8' });
    expect(out).toMatch(/includeKey/);
    expect(out).not.toMatch(/binary file matches/);
  });
});

/**
 * objectstack#5450 — the four files the baseline shipped with are now clean, and
 * KNOWN_OFFENDERS is empty.
 *
 * Two harms, so two assertion shapes. Three of the four carried U+0000 and were
 * genuinely invisible to content search, so the pin for those is a real grep
 * that must print a line. The fourth carried U+0001, which (measured on GNU grep
 * 3.11 and ripgrep 14) never blinded grep at all — claiming a search outage
 * there would be a fabricated pin, so it is asserted only on the byte's absence,
 * which is the harm it actually had: an unreviewable literal.
 */
describe('objectstack#5450 — the four baselined files are clean', () => {
  const cleaned = [
    { file: 'packages/core/src/evaluator/listConditional.ts', grepFor: 'warnedError' },
    { file: 'packages/core/src/utils/record-title.ts', grepFor: 'EMPTY_TOKEN' },
    { file: 'packages/fields/src/widgets/PeoplePicker.tsx', grepFor: 'recordsSignature' },
    // U+0001, not U+0000: never a search outage, so no grep assertion below.
    { file: 'packages/plugin-dashboard/src/DatasetWidget.tsx', grepFor: null },
  ];

  it.each(cleaned.map((c) => c.file))('%s carries no control byte at all', (file) => {
    const buf = fs.readFileSync(path.join(repoRoot, file));
    const found = [...buf].filter((b) => SCANNED_BYTES.has(b));
    expect(found).toEqual([]);
  });

  it.each(cleaned.filter((c) => c.grepFor).map((c) => [c.file, c.grepFor as string]))(
    '%s is visible to a content search again',
    (file, needle) => {
      const out = execFileSync('grep', ['-n', needle, file], { cwd: repoRoot, encoding: 'utf8' });
      expect(out).toMatch(new RegExp(needle));
      expect(out).not.toMatch(/binary file matches/);
    },
  );

  it('has no baseline entry left for any of them', () => {
    const baseline = KNOWN_OFFENDERS as Map<string, unknown>;
    for (const { file } of cleaned) {
      expect(baseline.has(file), `${file} is clean; its KNOWN_OFFENDERS entry must be gone`).toBe(false);
    }
  });
});

describe('wiring — the gate is actually reachable and actually runs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const workflowPath = path.join(repoRoot, '.github/workflows/control-bytes.yml');

  it('is exposed as a root package script', () => {
    expect(pkg.scripts['check:control-bytes']).toBe('node scripts/check-control-bytes.mjs');
  });

  it('has a workflow that gates pull requests', () => {
    expect(fs.existsSync(workflowPath), 'a check nothing runs is not a gate').toBe(true);
    expect(fs.readFileSync(workflowPath, 'utf8')).toMatch(/pull_request:/);
  });

  it('does NOT filter that workflow by path', () => {
    // This is the whole reason it is its own workflow rather than a step in
    // ci.yml or lint.yml: on a markdown-only change both of those skip every
    // expensive step, so a gate inside either would never see it. Markdown is
    // precisely the carrier objectstack#4890 was found in, so a path filter here
    // would rebuild the hole this guard exists to close. `changeset-guard.yml`
    // is in the repo for the same reason and says so in its own header.
    //
    // Not the reason this comment used to give — "both of those `paths-ignore`
    // markdown, `content/**`, `docs/**` and `.changeset/**`" — which
    // objectui#4381 corrected here and in the workflow's own header. Since
    // objectui#3523 step 2 that filter is gone from their `pull_request` trigger
    // and survives only on `push`, so a markdown-only PR does start both and
    // does produce their contexts (measured — PR #3856, one markdown file, 16
    // checks). What still skips is the work inside them: the `Decide whether
    // this change needs a full run` step excludes markdown and skips every step
    // below itself, and the `push` lane is filtered at the trigger as before.
    // The conclusion outlived its premise; objectui#3857 pinned the correction.
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    expect(workflow).not.toMatch(/paths-ignore:/);
    expect(workflow).not.toMatch(/^\s+paths:/m);
  });
});
