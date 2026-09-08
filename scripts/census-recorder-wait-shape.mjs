#!/usr/bin/env node
/**
 * Census: `await waitFor(...)` keyed on ONE recorder array, followed by a read
 * of a DIFFERENT recorder array, with nothing establishing the second was
 * filled. The shape objectui#8688 was one instance of; the corpus reading is
 * objectui#8690, and this file is that card's detector, kept so the next person
 * does not have to re-derive it.
 *
 * ⚠️ It answers WHERE TO LOOK, never WHAT IS WRONG. A flag is a site to read,
 * not a defect: objectui#8690 read all nine of its strict-shape flags and found
 * one worth repairing. ⛔ Never batch-repair a flag list.
 *
 * Algorithm (the card's four steps):
 *   1. per file, recorders = every identifier that is the target of `.push(`
 *   2. per `await waitFor(`, balance parens; recorders named inside = WAIT SET
 *   3. scan forward to the next `await` (or EOF), collecting recorders READ
 *      (a recorder's own `.push(` line does not count as a read)
 *   4. flag any read of a recorder the wait did not name
 *
 * Two recorder-matching modes, because the choice moves the numbers:
 *   --recorder-match=ident  bare identifiers (`calls`), receiver ignored
 *   --recorder-match=path   dotted paths (`server.savedOpts`) — the default
 *
 * Measured on da5e4f69e, 2776 tracked `*.test.ts`/`*.test.tsx` files:
 *   ident: 159 flags, 15 strict in 10 files
 *   path : 167 flags, 18 strict in 12 files
 * objectui#8690 reported 160 flags and 9 strict, so this re-derivation is one
 * flag off its total and wider in the strict bucket — near enough to be the
 * same instrument, ⛔ not near enough to quote its numbers as reproduced.
 * The two modes' strict buckets differ and neither contains the other: `ident`
 * misses a wait written `host.calls` (the receiver hides the recorder), `path`
 * misses a recorder pushed as a bare `inits` and read as `host.inits[0]`.
 * objectui#8690's nine sites are inside the UNION of the two, minus
 * `packages/permissions` (which objectui#8688 / PR #8689 already hold).
 *
 * Usage: node scripts/census-recorder-wait-shape.mjs [--recorder-match=ident|path]
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const mode = (process.argv.find((a) => a.startsWith('--recorder-match=')) ?? '').split('=')[1] || 'path';
if (!['ident', 'path'].includes(mode)) {
  console.error(`unknown --recorder-match=${mode} (expected ident|path)`);
  process.exit(2);
}

const files = execSync("git ls-files '*.test.ts' '*.test.tsx'", {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
}).split('\n').filter(Boolean);

const PUSH = mode === 'ident'
  ? /([A-Za-z_$][\w$]*)\s*\.push\s*\(/g
  : /([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\.push\s*\(/g;
const nameRe = (n) => new RegExp(`(?<![\\w$.])${n.replace(/\./g, '\\.')}(?![\\w$])`, 'g');
const lineOf = (src, index) => src.slice(0, index).split('\n').length;

const flags = [];
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const recorders = new Set();
  for (const m of src.matchAll(PUSH)) recorders.add(m[1]);
  if (recorders.size === 0) continue;

  for (const w of src.matchAll(/await\s+waitFor\s*\(/g)) {
    // 2. balance parens to the end of the wait
    const open = w.index + w[0].length - 1;
    let depth = 0;
    let end = -1;
    for (let j = open; j < src.length; j++) {
      if (src[j] === '(') depth++;
      else if (src[j] === ')' && --depth === 0) { end = j; break; }
    }
    if (end < 0) continue;
    const waitBody = src.slice(open, end + 1);
    const waitSet = new Set([...recorders].filter((r) => nameRe(r).test(waitBody)));

    // 3. forward window: end of the wait -> the next `await` (or EOF)
    const rest = src.slice(end + 1);
    const nextAwait = rest.search(/\bawait\b/);
    const window = nextAwait === -1 ? rest : rest.slice(0, nextAwait);

    for (const r of recorders) {
      if (waitSet.has(r)) continue;
      for (const hit of window.matchAll(nameRe(r))) {
        if (/^\s*\.push\s*\(/.test(window.slice(hit.index + r.length))) continue;
        flags.push({
          file,
          line: lineOf(src, end + 1 + hit.index),
          waitLine: lineOf(src, w.index),
          recorder: r,
          waitSet: [...waitSet],
        });
        break; // one flag per (wait, recorder)
      }
    }
  }
}

const strict = flags.filter((f) => f.waitSet.length > 0);
console.log(`recorder-match: ${mode}`);
console.log(`population:     ${files.length} test files`);
console.log(`total flags:    ${flags.length}`);
console.log(`  wait named a recorder (the strict shape): ${strict.length} in ${new Set(strict.map((f) => f.file)).size} files`);
console.log(`  wait named no recorder (a DOM node, a hook result, a test id): ${flags.length - strict.length}`);
console.log('--- strict-shape sites (READ each one; this list is not a defect list) ---');
for (const f of strict.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) {
  console.log(`${f.file}:${f.line}  wait@${f.waitLine} waits [${f.waitSet.join(', ')}] reads ${f.recorder}`);
}
