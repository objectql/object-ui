---
"@object-ui/i18n": patch
---

German pack: the 20 values that closed the German opening quote with an ASCII straight quote now close it with `“`

`packages/i18n/src/locales/de.ts` opened a quoted span with the German low-9
quote `„` (U+201E) and closed it with the ASCII typewriter quote `"` (U+0022) in
20 keys, so a German user read `Registerkarte „Alle Datensätze" anzeigen` — a
mismatched pair. `search.resultsCount` showed it most plainly: the value ended
`„{{query}}""`, the mismatched closer immediately followed by the TS string
terminator.

This was never a pack convention. Measured on `main@2937bcf7d` before the fix,
the same file already spelled 23 spans the correct German way, `„…“` — the two
styles sat side by side, in sibling keys of the same namespace. Every mismatched
closer is now `“` (U+201C), which is what German orthography (DUDEN R11) and the
majority of the file already used. Affected surfaces: the four empty states
(object / page / dashboard / report not found), the search results header, the
lookup "create named" action, four `console.objectView` strings, the home
getting-started hint, the six `navigationSync` toasts, the local marketplace
install toast, and the preview not-ready title.

No other language pack and no `en` value changed — the counts are unchanged for
every other locale, and the mismatch was measured only in `de`.

### Counted at landing, in two units

The card reported "20 values" and the triage re-scan reported "22 mismatched
pairs"; both are correct about different units, and the difference is now
recorded rather than left to the next reader. 20 keys carried a mismatch;
22 mismatch occurrences lived in them, because `navigationSync.renamedPage` and
`navigationSync.renamedDashboard` each quote two names in one sentence
("Seite „alt“ in „neu“ umbenannt") and so contribute two each. Full-file counts
before → after: `„` 45 → 45, `“` 25 → 47, `”` 2 → 2, `"` 28 → 6.

### The durable half, and why it is not the count equality the card proposed

Three i18n gates run over these packs and none can see a wrong quote:
`all-locales-key-parity` compares key sets and placeholder shapes,
`check-i18n-call-site-keys.mjs` only asks whether a key resolves, and
`check-i18n-en-drift.mjs` fires on `en` **value changes** — these values were
wrong from the day they landed, so no drift event ever existed. Without a
value-domain assertion the next backfill copies the mismatch from a neighbour
again, which is exactly how these 20 accumulated.

The card proposed asserting `count(„) === count(“)`. That is **false on the
correctly fixed file** (45 vs 47) and would have sent the next reader hunting a
bug that is not there: two values in this pack, `grid.import.savedMappingHint`
and `grid.import.savedMappingPreviewNote`, are still untranslated English prose
and quote in the English style `“…”`, so their two `“` are legitimate *openers*.
The invariant that is pinned instead is the pairing itself — for every `„`, the
first quote character that follows must be `“` — backed by the arithmetic
identity `count(“) === count(„) + count(”)`, which stays true if those two values
are later translated (47 === 47 + 0) and breaks the moment a mismatch returns.
Both carry a presence guard so a broken import cannot make them pass by scanning
nothing.
