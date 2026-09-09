#!/usr/bin/env bash
# Ablation harness for objectui#8464. Mutates a READ SITE, never a pin.
set -uo pipefail

REPO_ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
cd "$REPO_ROOT"
TARGET_REL="packages/plugin-detail/src/DetailView.tsx"
SET_REL="packages/plugin-detail/src/summaryChipRenderers.ts"
TARGET="$REPO_ROOT/$TARGET_REL"
SET_FILE="$REPO_ROOT/$SET_REL"
OUT="${ABL_OUT:-/tmp/ablation-8464}"
mkdir -p "$OUT"

restore() {
  git -C "$REPO_ROOT" checkout HEAD -- "$TARGET" "$SET_FILE" 2>/dev/null || true
}
trap restore EXIT INT TERM

blob_at_head() { git -C "$REPO_ROOT" rev-parse "HEAD:$1"; }

# Prove a mutation LANDED: both directions (anchor gone / injected present),
# a hash that differs from the HEAD blob, and a line-total gate.
prove_mutated() {  # $1 rel path  $2 removed-anchor  $3 injected-anchor  $4 expected line delta
  local rel="$1" gone="$2" added="$3" delta="$4"
  local abs="$REPO_ROOT/$rel"
  local head_blob now_blob
  head_blob="$(blob_at_head "$rel")"
  now_blob="$(git -C "$REPO_ROOT" hash-object "$abs")"
  if [ -z "$now_blob" ] || [ -z "$head_blob" ]; then
    echo "ABLATION FAILURE: empty hash — path did not resolve ($rel)"; exit 3
  fi
  if [ "$now_blob" = "$head_blob" ]; then
    echo "ABLATION FAILURE: $rel is byte-identical to HEAD — the mutation did not land"; exit 3
  fi
  local n_gone n_added
  n_gone="$(grep -c -- "$gone" "$abs" || true)"
  n_added="$(grep -c -- "$added" "$abs" || true)"
  if [ "$n_gone" != "0" ]; then
    echo "ABLATION FAILURE: the removed anchor is still present ($n_gone) in $rel"; exit 3
  fi
  if [ "$n_added" = "0" ]; then
    echo "ABLATION FAILURE: the injected anchor is absent from $rel"; exit 3
  fi
  local head_lines now_lines
  head_lines="$(git -C "$REPO_ROOT" show "HEAD:$rel" | wc -l)"
  now_lines="$(wc -l < "$abs")"
  if [ "$(( now_lines - head_lines ))" != "$delta" ]; then
    echo "ABLATION FAILURE: line-total gate — expected delta $delta, got $(( now_lines - head_lines ))"; exit 3
  fi
  echo "  mutation ON DISK: $rel  head=$head_blob now=$now_blob  removed-anchor=0  injected-anchor=$n_added  lines ${head_lines}->${now_lines}"
}

prove_restored() {
  restore
  local d
  d="$(git -C "$REPO_ROOT" diff HEAD --name-only)"
  if [ -n "$d" ]; then
    echo "ABLATION FAILURE: restore left the tree dirty: $d"; exit 3
  fi
  echo "  restored BY STATE: git diff HEAD is empty"
}

run_suite() {  # $1 label
  local label="$1"
  pnpm exec vitest run \
    packages/plugin-detail/src/__tests__/summaryChip.objectValue-8464.test.tsx \
    packages/plugin-detail/src/__tests__/summaryChip.badgeFitCensus-8464.test.tsx \
    --reporter=json --outputFile="$OUT/$label.json" > "$OUT/$label.log" 2>&1
  echo "  vitest exit: $?"
  node -e '
    const fs=require("fs");
    const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
    const rows=[];
    for(const f of r.testResults||[]) for(const a of f.assertionResults||[])
      rows.push([a.status, a.fullName]);
    const failed=rows.filter(([s])=>s==="failed");
    console.log("  TOTAL "+rows.length+"  PASSED "+rows.filter(([s])=>s==="passed").length+"  FAILED "+failed.length);
    for(const [,n] of failed) console.log("    RED  "+n);
  ' "$OUT/$label.json"
}

echo "== BASELINE (HEAD, unmutated) =="
prove_restored
run_suite baseline

echo
echo "== CARICATURE 1 — render nothing for every object (the fenced option B) =="
python3 - "$TARGET" <<'PY'
import sys
p=sys.argv[1]; s=open(p).read()
old="                  const chipField = enrichDetailField("
new="                  if (val !== null && typeof val === 'object') return null; // ABLATION-B\n"+old
assert s.count(old)==1
open(p,'w').write(s.replace(old,new,1))
PY
prove_mutated "$TARGET_REL" "ABLATION-NEVER-PRESENT-XYZ" "ABLATION-B" 1
run_suite caricature1
prove_restored

echo
echo "== CARICATURE 2 — route EVERY value through the cell renderer regardless of kind =="
python3 - "$TARGET" <<'PY'
import sys
p=sys.argv[1]; s=open(p).read()
old="""                  const ChipCellRenderer =
                    display.includes('[object Object]') && chipTakesCellRenderer(chipRendererType)
                      ? getCellRenderer(chipRendererType)
                      : null;"""
new="""                  const ChipCellRenderer = getCellRenderer(chipRendererType); // ABLATION-C"""
assert s.count(old)==1
open(p,'w').write(s.replace(old,new,1))
PY
prove_mutated "$TARGET_REL" "chipTakesCellRenderer(chipRendererType)" "ABLATION-C" -3
run_suite caricature2
prove_restored

echo
echo "== CARICATURE 3 — refuse the renderer for EVERY kind (the census's own caricature) =="
python3 - "$SET_FILE" <<'PY'
import sys
p=sys.argv[1]; s=open(p).read()
old="  return !CHIP_UNFIT_RENDERER_TYPES.has(rendererType);"
new="  return false; // ABLATION-D\n  return !CHIP_UNFIT_RENDERER_TYPES.has(rendererType);"
assert s.count(old)==1
open(p,'w').write(s.replace(old,new,1))
PY
prove_mutated "$SET_REL" "ABLATION-NEVER-PRESENT-XYZ" "ABLATION-D" 1
run_suite caricature3
prove_restored
echo
echo "ABLATION COMPLETE"
