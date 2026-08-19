---
'@object-ui/components': patch
---

Remove two unreachable renderer registrations, and fail the build on any new same-namespace duplicate.

The component registry silently keeps the LAST registration for a given
`namespace:type` key. Two renderers on `main` were therefore dead code — they
compiled, type-checked, and never ran:

- `renderers/data-display/table.tsx` (`SimpleTableRenderer`) lost `ui:table` to
  `renderers/complex/table.tsx`, because `renderers/index.ts` imports
  `./data-display` before `./complex`. It was the only table renderer that read
  `bind`, which is why a `table` node with a two-row `bind` rendered a header and
  zero rows (objectui#5125).
- The `kbd` entry in `renderers/basic/html-elements.tsx`'s `TAGS` loop lost
  `ui:kbd` to `renderers/data-display/kbd.tsx` — despite that list's own comment
  stating it excludes anything already registered.

In both cases the renderer that serves the key today is the one kept, so no
reachable behaviour changes: `table` still renders inline `data` against
`columns` and still ignores `bind`, and `kbd` still renders one `<kbd>` per entry
in `keys`. Both readings are now pinned by tests.

Whether `table` *should* read `bind` is deliberately left open — that would widen
the authorable key surface and is a product decision, not a consequence of
deleting dead code.

The new gate (`renderers/__tests__/registration-uniqueness.test.tsx`) counts every
registration the production barrel makes and fails on any key registered twice
under one namespace, so a re-introduced duplicate is caught at CI rather than by
an accidental probe. It is a test rather than a runtime warning because
re-registering a key is a supported pattern for test stubs, and a warning there
would fire mostly on legitimate overrides.
