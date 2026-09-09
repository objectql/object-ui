#!/usr/bin/env bash
# Ablation legs 4-5 for objectui#8464 — the CENSUS's own load-bearing halves.
# Mutates a READ SITE in @object-ui/fields (`getCellRenderer`), never a pin.
# Vitest aliases '@object-ui/fields' -> packages/fields/src (vitest.config.mts
# line 507), so the source edit IS what the test executes; no dist is involved.
set -uo pipefail

REPO_ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
cd "$REPO_ROOT"
REL="packages/fields/src/index.tsx"
ABS="$REPO_ROOT/$REL"
OUT="${ABL_OUT:-/tmp/ablation-8464}"
mkdir -p "$OUT"

restore() { git -C "$REPO_ROOT" checkout HEAD -- "$ABS" 2>/dev/null || true; }
trap restore EXIT INT TERM

prove_mutated() {  # $1 injected-anchor  $2 expected line delta
  local added="$1" delta="$2"
  local head_blob now_blob n_added head_lines now_lines
  head_blob="$(git -C "$REPO_ROOT" rev-parse "HEAD:$REL")"
  now_blob="$(git -C "$REPO_ROOT" hash-object "$ABS")"
  [ -n "$head_blob" ] && [ -n "$now_blob" ] || { echo "ABLATION FAILURE: empty hash"; exit 3; }
  [ "$head_blob" != "$now_blob" ] || { echo "ABLATION FAILURE: byte-identical to HEAD"; exit 3; }
  n_added="$(grep -c -- "$added" "$ABS" || true)"
  [ "$n_added" != "0" ] || { echo "ABLATION FAILURE: injected anchor absent"; exit 3; }
  # The other direction: the unmutated function must no longer be reachable —
  # its first registry lookup is gone from the executed path, proven by the
  # early return sitting ABOVE it.
  grep -q "if (fieldRegistry.has(fieldType))" "$ABS" || { echo "ABLATION FAILURE: lost the anchor we mutate around"; exit 3; }
  head_lines="$(git -C "$REPO_ROOT" show "HEAD:$REL" | wc -l)"
  now_lines="$(wc -l < "$ABS")"
  [ "$(( now_lines - head_lines ))" = "$delta" ] || { echo "ABLATION FAILURE: line gate expected $delta got $(( now_lines - head_lines ))"; exit 3; }
  echo "  mutation ON DISK: $REL  head=$head_blob now=$now_blob  injected-anchor=$n_added  lines ${head_lines}->${now_lines}"
}

prove_restored() {
  restore
  local d; d="$(git -C "$REPO_ROOT" diff HEAD --name-only)"
  [ -z "$d" ] || { echo "ABLATION FAILURE: restore left tree dirty: $d"; exit 3; }
  echo "  restored BY STATE: git diff HEAD is empty"
}

run_suite() {
  local label="$1"
  pnpm exec vitest run \
    packages/plugin-detail/src/__tests__/summaryChip.badgeFitCensus-8464.test.tsx \
    --reporter=json --outputFile="$OUT/$label.json" > "$OUT/$label.log" 2>&1
  echo "  vitest exit: $?"
  node -e '
    const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
    const rows=[]; for(const f of r.testResults||[]) for(const a of f.assertionResults||[]) rows.push([a.status,a.fullName]);
    const failed=rows.filter(([s])=>s==="failed");
    console.log("  TOTAL "+rows.length+"  PASSED "+rows.filter(([s])=>s==="passed").length+"  FAILED "+failed.length);
    for(const [,n] of failed) console.log("    RED  "+n);
  ' "$OUT/$label.json"
}

mutate() {  # $1 = replacement body line
  python3 - "$ABS" "$1" <<'PY'
import sys
p, inject = sys.argv[1], sys.argv[2]
s=open(p).read()
old="export function getCellRenderer(fieldType: string): React.FC<CellRendererProps> {\n"
assert s.count(old)==1, s.count(old)
open(p,'w').write(s.replace(old, old+"  "+inject+"\n", 1))
PY
}

echo "== CARICATURE 4 - every type answers what the text cell answers =="
mutate "return TextCellRenderer; // ABLATION-E"
prove_mutated "ABLATION-E" 1
run_suite caricature4
prove_restored

echo
echo "== CARICATURE 5 — every type draws the shared No-value affordance =="
mutate "return () => <EmptyValue />; // ABLATION-F"
prove_mutated "ABLATION-F" 1
run_suite caricature5
prove_restored
echo
echo "ABLATION 2 COMPLETE"
