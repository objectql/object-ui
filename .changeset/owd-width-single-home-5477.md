---
'@object-ui/app-shell': patch
---

`ObjectSettingsPanel` now calls `isExternalWider` from `owd-sharing.ts` instead of
re-declaring `OWD_WIDTH` and the ADR-0090 D11 width comparison inline (objectui#5477).

`owd-sharing.ts` states its own purpose — it is "the single home" for the pieces the
per-object Settings tab and the package-level OWD overview must agree on, the D11
"external ≤ internal" comparison among them — and the Settings tab was the one surface
not calling it. The two implementations were verified equivalent before the swap, over
the full domain of both dials plus `undefined`, the rejected legacy aliases and
prototype-chain keys: 144 input pairs, zero disagreements. The module's extra `!!`
truthiness guards are redundant at this call site, which already normalizes both dials
to `''`, and `'' in OWD_WIDTH` is false regardless. So no author-visible verdict
changes — the same three pairs warn, and the same twenty-two stay calm.

The substantive half is the pin that keeps it that way. `ObjectSettingsPanel.owdAgreement.test.tsx`
drives BOTH surfaces over the full 5×5 cross-product of the values their dials offer and
requires all three legs — the Settings tab's rendered warning, the overview's per-row
error, and `isExternalWider` itself — to agree on every pair, with the violating pairs
pinned by name so the sweep cannot pass vacuously. Re-inlining a drifted copy into either
surface, swapping the `(internal, external)` argument order, or refining D11 in only one
place now fails a test instead of silently leaving the authoring surface enforcing the
old rule.
