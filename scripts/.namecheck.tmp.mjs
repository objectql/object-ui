import ts from "typescript";
import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
const require = createRequire(import.meta.url);
const pkgPath = require.resolve("@objectstack/spec/package.json");
const pkgDir = dirname(pkgPath);
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const entries = [];
for (const [sub, cond] of Object.entries(pkg.exports ?? {})) {
  if (typeof cond !== "object" || cond === null) continue;
  const dts = cond?.import?.types ?? cond?.require?.types;
  if (dts) entries.push({ sub, file: resolve(pkgDir, dts) });
}
const program = ts.createProgram(entries.map(e => e.file), { noEmit: true, skipLibCheck: true, strict: false, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler });
const checker = program.getTypeChecker();
const names = new Map();
for (const e of entries) {
  const sf = program.getSourceFile(e.file); if (!sf) continue;
  const m = checker.getSymbolAtLocation(sf); if (!m) continue;
  for (const x of checker.getExportsOfModule(m)) {
    if (!names.has(x.getName())) names.set(x.getName(), []);
    names.get(x.getName()).push(e.sub);
  }
}
console.log(`spec exports: ${names.size}`);
for (const n of process.argv.slice(2)) console.log(`${names.has(n) ? "TAKEN in " + names.get(n).join(",") : "free"}   ${n}`);
