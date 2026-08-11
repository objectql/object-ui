---
"@object-ui/app-shell": minor
"@object-ui/components": minor
"@object-ui/types": minor
"@object-ui/core": minor
---

Retire the `global_nav` Studio designer surfaces, and track the `@objectstack` family at `17.0.0-rc.6` (objectstack#7100 / objectstack#6888).

## The retirement

`global_nav` was an `ACTION_LOCATIONS` member no running-app surface ever rendered. The console's ⌘K palette (`app-shell/src/chrome/CommandPalette.tsx`) builds its groups from nav items, objects, dashboards, pages, reports, recent items, record search and theme; it holds no reference to `global_nav`, to `actionRendersAt`, or to any action-metadata source. An action declaring `locations: ['global_nav']` therefore never reached a user.

The Studio designer previewed it anyway — a mock frame reading `⌘K · Command palette` with the author's button inside it. That is the sharp edge the maintainer's 2026-08-09 ruling on objectstack#6888 named: an authoring tool promising a surface the product does not have teaches authors, and every AI copying this corpus, to declare dead metadata. `@objectstack/spec` `17.0.0-rc.6` retired the member (7 members → 6) with a named rejection message; this release removes the designer surfaces that outlived it.

- `metadata-admin/previews/ActionPreview.tsx` — the mock command-palette placement frame is gone. The metadata strip above it still ECHOES whatever `locations` the draft declares, deliberately: reporting what a (possibly stale) draft says is honest, whereas the frame CLAIMED the platform renders it.
- `metadata-admin/inspectors/ActionDefaultInspector.tsx` — the `global_nav` entry is gone from `LOCATION_LABELS`. That map is typed `Record< ActionLocation, string >`, so the retirement reached it as a compile error rather than as a silently stale dropdown — the mechanism objectui#3017 installed, firing as designed.
- `metadata-admin/previews/block-config.ts` — the `record:quick_actions` location dropdown no longer offers it, and both locale tables drop the now-orphaned `…option.location.global_nav` key.
- `@object-ui/components`' `action:bar` doc comment is aligned. The component's published enum is `[...ACTION_LOCATIONS]`, so it followed the retirement on its own; only the prose was stale.

`@object-ui/core`'s `ActionEngine.getActionsForLocation` is **unchanged and still answers a literal string match**. Narrowing it to the six live members would put a second rejection point beside the schema's — the tolerant-consumer shape the strict-contract rule forbids, inverted. Enforcement stays where it belongs: the parameter type is now six-membered so no type-correct caller can spell the retired value, and `ActionLocationSchema` rejects it by name at authoring and publish time.

## The dependency move

All 37 `@objectstack/*` declarations across 30 `package.json` files move from `^17.0.0-rc.5` to `^17.0.0-rc.6`, and `pnpm-lock.yaml` resolves one copy of each family package at rc.6. The siblings move with `spec` because `client` / `formula` / `lint` pin it **exactly** — leaving them behind would keep two copies of the spec in the tree, the split brain objectui#3560 called out.

Bumping the pin and repairing the fallout cannot be split: at rc.5 the `Record< ActionLocation, string >` above is missing a key, at rc.6 it has an excess one.

## Breaking, in FROM → TO form

- **`@object-ui/types`' `Theme` now binds the spec's `Theme`, not `ThemeInput`.** rc.6 retired every `…Input` alias and moved the bare name onto the `z.input` side (`X` = `z.input`, `XParsed` = `z.infer`). The runtime shape and this package's exported name are unchanged — `Theme` was, and still is, the AUTHORING shape where `mode` is optional. Re-pointing at `ThemeParsed` would have been the silent swap.
- **`SpecReport` / `SpecReportChart` re-point to `ReportParsed` / `ReportChartParsed`, and `SpecReportInput` / `SpecReportChartInput` to `Report` / `ReportChart`.** Same rename, same rule: each local alias keeps the SIDE it had at rc.5.
- **`@object-ui/types` no longer re-exports `I18nObject`, `LocaleConfig`, `PluralRule`, `DateFormat` or `NumberFormat`** — all five were retired by rc.6. They were dead re-exports here: nothing in this repo imported them from `@object-ui/types` (`@object-ui/i18n`'s formatter vocabulary in `utils/spec-formatters.ts` is locally declared and never bound the spec symbols). `I18nLabel` survives and is unchanged as a name.
- **`I18nLabel` itself widened from `string` to `string | Record< string, string >`** — rc.6 folded the retired `I18nObject`'s per-locale map into it and ships `resolveI18nLabel(label, locale)` as the shared resolver. Every read in this repo that lands in a text slot now goes through that resolver, so an inline map renders its locale instead of `[object Object]`. Reads the compiler cannot see are audited separately in objectui#4163.
- **`@object-ui/types`' `GlobalFilterSchema` derives via `.safeExtend`, not `.extend`.** rc.6's `GlobalFilterSchema` carries a refinement and zod 4 refuses `.extend()` on a refined object outright, which threw at module load. `.safeExtend` is zod's prescribed replacement and KEEPS the refinement, so the spec's cross-field rule now also runs on this package's dialect — which is the intended behaviour, since the pinned divergences widen individual fields and were never meant to switch off a whole-object rule.
