---
"@object-ui/react": patch
"@object-ui/cli": patch
---

Name the case-only spelling when a component type misses the registry.

Registry lookup is exactly case-sensitive, so a node typed `Page` misses a registered `page` and falls through to the OBJUI-001 "Unknown component type" panel. Because the mistake is usually uniform across a document, the symptom is not one broken widget — it is the whole page rendering as error panels, with nothing in the message pointing at the cause.

Both surfaces that report the miss now name the spelling that would have resolved. `SchemaRenderer`'s panel reads `Unknown component type: Page — did you mean 'page'?`, and `objectui check` reports `Unknown schema type "Page" in <file> — did you mean "page"?`. When no known type differs by case alone, neither says anything extra — `zzz` gains no bogus suggestion, and this is case matching, not an edit distance, so `pge` suggests nothing either.

**Lookup itself does not change.** `Page` still misses, still fails, and still renders the panel; only the message teaches. Normalising the lookup was considered and rejected (objectui#5247, maintainer ruling 2026-08-19): it would make two spellings valid everywhere, permanently, and legalise the typo class (`PAGE`, `pAge`) along with the PascalCase convention.

Each surface reads its candidates from the set it can actually trust — the renderer from the live `ComponentRegistry` (including pending lazy stubs), the CLI from the registration-derived `KNOWN_SCHEMA_TYPES` snapshot — so neither can suggest a type nothing registers.
