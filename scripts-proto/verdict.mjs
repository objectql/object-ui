// THROWAWAY — objectui#5403 measurement instrument. Not to be merged.
// Compares two Istanbul coverage-final.json files and encodes the answer in a
// string safe to use as an ARTIFACT NAME. The measuring session can read
// artifact names through the REST API; it cannot read Actions logs, artifact
// bodies, or (as this instrument found) push a results branch with the
// workflow token. So the name is the channel.
import { readFileSync, existsSync, appendFileSync } from 'node:fs';

const [aPath, bPath, label] = process.argv.slice(2);
const out = (k, v) => { if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`); };
for (const p of [aPath, bPath]) {
  if (!existsSync(p)) { out('name', `${label}__MISSING-INPUT`); console.log('missing', p); process.exit(1); }
}
const norm = (o) => { const r = {}; for (const k of Object.keys(o)) r[k.replace(/^.*?\/objectui[^/]*\//, '')] = o[k]; return r; };
const A = norm(JSON.parse(readFileSync(aPath, 'utf8')));
const B = norm(JSON.parse(readFileSync(bPath, 'utf8')));
const ka = new Set(Object.keys(A)), kb = new Set(Object.keys(B));
const onlyA = [...ka].filter((k) => !kb.has(k));
const onlyB = [...kb].filter((k) => !ka.has(k));
const tot = (o) => { let s = 0, c = 0; for (const e of Object.values(o)) for (const v of Object.values(e.s ?? {})) { s++; if (v > 0) c++; } return { s, c }; };
const ta = tot(A), tb = tot(B);
const pct = (x, t) => (t ? (100 * x) / t : 0);
const deltaPP = (pct(tb.c, tb.s) - pct(ta.c, ta.s)).toFixed(4);
let regressed = 0;
for (const k of [...ka].filter((x) => kb.has(x))) {
  const ca = Object.values(A[k].s ?? {}).filter((v) => v > 0).length;
  const cb = Object.values(B[k].s ?? {}).filter((v) => v > 0).length;
  if (cb < ca) regressed++;
}
const name = [
  label,
  `filesA-${ka.size}`,
  `filesB-${kb.size}`,
  `onlyA-${onlyA.length}`,
  `onlyB-${onlyB.length}`,
  `stmtA-${ta.c}of${ta.s}`,
  `stmtB-${tb.c}of${tb.s}`,
  `stmtDiff-${tb.c - ta.c}`,
  // Spell the sign as a word: an earlier version encoded it with a hyphen and
  // the value's own hyphen made the sign unreadable in the artifact name.
  `deltaPP-${Number(deltaPP) < 0 ? 'NEG' : 'POS'}-${Math.abs(Number(deltaPP)).toFixed(4).replace('.', 'p')}`,
  `regressed-${regressed}`,
].join('__');
console.log(name);
out('name', name);
