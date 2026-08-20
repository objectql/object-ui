// THROWAWAY — objectui#5403 measurement instrument. Not to be merged.
// Adapted from objectui#5395's instrument of the same name, plus a
// $GITHUB_OUTPUT channel. Answers the equivalence question the card makes the
// acceptance test: does the merged 4-shard report contain the same files, and
// the same or better hit counts, as the single unsharded report produced from
// the same commit?
import { readFileSync, existsSync, appendFileSync } from 'node:fs';

const [aPath, bPath] = process.argv.slice(2);
const lines = [];
const emit = (t) => { console.log(`::notice title=PROTO-5403-COMPARE::${t}`); console.log(t); lines.push(t); };
const finish = () => {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `lines<<PROTO_EOF\n${lines.join('\n')}\nPROTO_EOF\n`);
  }
};
for (const p of [aPath, bPath]) {
  if (!existsSync(p)) { emit(`MISSING ${p} — comparison impossible`); finish(); process.exit(0); }
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
const pct = (x, t) => (t ? ((100 * x) / t).toFixed(4) : '0');

let regressed = 0;
const worst = [];
for (const k of [...ka].filter((x) => kb.has(x))) {
  const ca = Object.values(a[k].s ?? {}).filter((v) => v > 0).length;
  const cb = Object.values(b[k].s ?? {}).filter((v) => v > 0).length;
  if (cb < ca) { regressed++; worst.push(`${k}:${ca}->${cb}`); }
}
emit(`fileCount unsharded=${ka.size} merged=${kb.size} onlyUnsharded=${onlyUnsharded.length} onlyMerged=${onlyMerged.length}`);
emit(`statements unsharded=${ta.sc}/${ta.s} (${pct(ta.sc, ta.s)}%) merged=${tb.sc}/${tb.s} (${pct(tb.sc, tb.s)}%) delta=${(pct(tb.sc, tb.s) - pct(ta.sc, ta.s)).toFixed(4)} pp | statementDelta=${tb.sc - ta.sc}`);
emit(`functions unsharded=${ta.fc}/${ta.f} merged=${tb.fc}/${tb.f} | branches unsharded=${ta.bc}/${ta.br} merged=${tb.bc}/${tb.br}`);
emit(`filesWithFewerCoveredStatementsInMerged=${regressed}`);
if (onlyUnsharded.length) emit(`DROPPED BY SHARDING (first 5): ${onlyUnsharded.slice(0, 5).join(' ')}`);
if (onlyMerged.length) emit(`ONLY IN MERGED (first 5): ${onlyMerged.slice(0, 5).join(' ')}`);
if (worst.length) emit(`REGRESSED FILES (first 5): ${worst.slice(0, 5).join(' ')}`);
finish();
