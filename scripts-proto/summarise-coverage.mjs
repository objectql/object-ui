// THROWAWAY — objectui#5395 measurement instrument. Not to be merged.
// Reads an Istanbul-format coverage-final.json and emits its totals as GitHub
// annotations, which the measuring session can read back through the REST API
// (the Actions log/artifact CDN is blocked by its egress proxy).
import { readFileSync, existsSync } from 'node:fs';

const [file, label] = process.argv.slice(2);
if (!existsSync(file)) {
  console.log(`::error title=PROTO-5395-${label}::NO COVERAGE FILE at ${file}`);
  process.exit(0);
}
const cov = JSON.parse(readFileSync(file, 'utf8'));
const files = Object.keys(cov).sort();
let s = 0, sc = 0, f = 0, fc = 0, b = 0, bc = 0;
for (const k of files) {
  const e = cov[k];
  for (const v of Object.values(e.s ?? {})) { s++; if (v > 0) sc++; }
  for (const v of Object.values(e.f ?? {})) { f++; if (v > 0) fc++; }
  for (const arr of Object.values(e.b ?? {})) {
    for (const v of arr) { b++; if (v > 0) bc++; }
  }
}
const pctOf = (a, t) => (t ? ((100 * a) / t).toFixed(4) : '0');
const line =
  `files=${files.length} statements=${sc}/${s} (${pctOf(sc, s)}%) ` +
  `functions=${fc}/${f} (${pctOf(fc, f)}%) branches=${bc}/${b} (${pctOf(bc, b)}%)`;
console.log(`::error title=PROTO-5395-${label}::${line}`);
console.log(`::notice title=PROTO-5395-${label}::${line}`);
console.log(line);
