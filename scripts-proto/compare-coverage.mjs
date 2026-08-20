// THROWAWAY — objectui#5395 measurement instrument. Not to be merged.
// Answers the only equivalence question Codecov cares about: does the merged
// 4-shard report contain the same files, and the same or better hit counts,
// as the single unsharded report produced from the same commit?
import { readFileSync, existsSync } from 'node:fs';

const [aPath, bPath] = process.argv.slice(2);
for (const p of [aPath, bPath]) {
  if (!existsSync(p)) {
    console.log(`::error title=PROTO-5395-COMPARE::missing ${p}`);
    process.exit(0);
  }
}
const A = JSON.parse(readFileSync(aPath, 'utf8')); // unsharded
const B = JSON.parse(readFileSync(bPath, 'utf8')); // merged

const norm = (o) => {
  const out = {};
  for (const k of Object.keys(o)) out[k.replace(/^.*?\/objectui[^/]*\//, '')] = o[k];
  return out;
};
const a = norm(A), b = norm(B);
const ka = new Set(Object.keys(a)), kb = new Set(Object.keys(b));
const onlyUnsharded = [...ka].filter((k) => !kb.has(k)).sort();
const onlyMerged = [...kb].filter((k) => !ka.has(k)).sort();

const totals = (o) => {
  let s = 0, sc = 0, f = 0, fc = 0, br = 0, bc = 0;
  for (const e of Object.values(o)) {
    for (const v of Object.values(e.s ?? {})) { s++; if (v > 0) sc++; }
    for (const v of Object.values(e.f ?? {})) { f++; if (v > 0) fc++; }
    for (const arr of Object.values(e.b ?? {})) for (const v of arr) { br++; if (v > 0) bc++; }
  }
  return { s, sc, f, fc, br, bc };
};
const ta = totals(a), tb = totals(b);

// Per-file: does the merged report ever show FEWER covered statements than the
// unsharded one? That is the only way sharding could lose real coverage.
let regressed = 0;
const worst = [];
for (const k of [...ka].filter((x) => kb.has(x))) {
  const ca = Object.values(a[k].s ?? {}).filter((v) => v > 0).length;
  const cb = Object.values(b[k].s ?? {}).filter((v) => v > 0).length;
  if (cb < ca) { regressed++; worst.push(`${k}:${ca}->${cb}`); }
}
const emit = (t) => { console.log(`::error title=PROTO-5395-COMPARE::${t}`); console.log(t); };
emit(`fileCount unsharded=${ka.size} merged=${kb.size} onlyUnsharded=${onlyUnsharded.length} onlyMerged=${onlyMerged.length}`);
emit(`statements unsharded=${ta.sc}/${ta.s} merged=${tb.sc}/${tb.s} | functions unsharded=${ta.fc}/${ta.f} merged=${tb.fc}/${tb.f} | branches unsharded=${ta.bc}/${ta.br} merged=${tb.bc}/${tb.br}`);
emit(`filesWithFewerCoveredStatementsInMerged=${regressed}`);
if (onlyUnsharded.length) emit(`DROPPED BY SHARDING (first 5): ${onlyUnsharded.slice(0, 5).join(' ')}`);
if (onlyMerged.length) emit(`ONLY IN MERGED (first 5): ${onlyMerged.slice(0, 5).join(' ')}`);
if (worst.length) emit(`REGRESSED FILES (first 5): ${worst.slice(0, 5).join(' ')}`);
