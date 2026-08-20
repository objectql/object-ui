// THROWAWAY — objectui#5403 measurement instrument. Not to be merged.
// Adapted from objectui#5395's instrument of the same name. Reads an
// Istanbul-format coverage-final.json and emits its totals both as GitHub
// annotations and on a $GITHUB_OUTPUT line, because this session can read
// neither the Actions log CDN nor artifact bodies — the results come back as
// a file the final job pushes to a branch.
import { readFileSync, existsSync, appendFileSync } from 'node:fs';

const [file, label] = process.argv.slice(2);
const out = (key, value) => {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
};
if (!existsSync(file)) {
  const miss = `NO COVERAGE FILE at ${file}`;
  console.log(`::error title=PROTO-5403-${label}::${miss}`);
  out('summary', miss);
  out('present', 'no');
  process.exit(0);
}
const cov = JSON.parse(readFileSync(file, 'utf8'));
const files = Object.keys(cov).sort();
let s = 0, sc = 0, f = 0, fc = 0, b = 0, bc = 0;
for (const k of files) {
  const e = cov[k];
  for (const v of Object.values(e.s ?? {})) { s++; if (v > 0) sc++; }
  for (const v of Object.values(e.f ?? {})) { f++; if (v > 0) fc++; }
  for (const arr of Object.values(e.b ?? {})) for (const v of arr) { b++; if (v > 0) bc++; }
}
const pctOf = (a, t) => (t ? ((100 * a) / t).toFixed(4) : '0');
const line =
  `files=${files.length} statements=${sc}/${s} (${pctOf(sc, s)}%) ` +
  `functions=${fc}/${f} (${pctOf(fc, f)}%) branches=${bc}/${b} (${pctOf(bc, b)}%)`;
console.log(`::notice title=PROTO-5403-${label}::${line}`);
console.log(line);
out('summary', line);
out('present', 'yes');
