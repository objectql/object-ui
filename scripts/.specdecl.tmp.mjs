import ts from "typescript";
import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
const require = createRequire(import.meta.url);
const pkgPath = require.resolve("@objectstack/spec/package.json");
const pkgDir = dirname(pkgPath);
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const [subArg, ...names] = process.argv.slice(2);
const sub = subArg === "." ? "." : "./" + subArg;
const dts = resolve(pkgDir, pkg.exports[sub].import.types);
const program = ts.createProgram([dts], { noEmit: true, skipLibCheck: true, strict: true, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler });
const checker = program.getTypeChecker();
const sf = program.getSourceFile(dts);
const exports = checker.getExportsOfModule(checker.getSymbolAtLocation(sf));
if (names[0] === "--grep") {
  const re = new RegExp(names[1], "i");
  console.log(exports.map(e => e.getName()).filter(n => re.test(n)).sort().join("\n"));
} else for (const name of names) {
  const sym = exports.find((e) => e.getName() === name);
  if (!sym) { console.log(`### ${name}: NOT EXPORTED`); continue; }
  const target = (sym.flags & ts.SymbolFlags.Alias) ? checker.getAliasedSymbol(sym) : sym;
  console.log(`### ${name}`);
  for (const d of target.getDeclarations() ?? []) console.log(d.getText().slice(0, 2500));
}
