---
"@object-ui/app-shell": patch
"@object-ui/components": patch
"@object-ui/plugin-form": patch
"@object-ui/fields": patch
---

fix(page,field): consume the spec's `type`/`label`/`maxLength` keys (framework#1878 §3 naming-drift recheck)

Three forward-drifts where objectui read a different key than the spec
declares, so authoring the documented key silently no-oped:

- **page `type` → `pageType`** (app-shell + components): `PageSchema` declares
  the page KIND as `type`, but `PageRenderer` reads `schema.pageType` and fell
  back to `'record'` — and nothing mapped between them. Every non-record page
  (`home`/`app`/`list`/`utility`) rendered with the record max-width, a wrong
  `data-page-type` attribute, and a suppressed header. `PageView` now passes
  `pageType` alongside the SchemaNode discriminator `type`.
- **page `label` → `title`** (components): `PageSchema.label` is required but the
  region renderer read only `title`. Now dual-reads `title ?? label`, mirroring
  the fallback `DashboardRenderer` already uses. Coupled with the above — the
  header is gated on `pageType !== 'record'`, so both were needed for a title to
  appear.
- **field `maxLength`/`minLength`** (plugin-form + fields): validation already
  dual-read these, but `ObjectForm`'s HTML-attribute pass and `TextAreaField`
  read `max_length` only, so a spec-authored `maxLength` gave no browser cap and
  no character counter. Both now dual-read, matching `buildValidationRules`.

Verified in the browser against the showcase: `capability_map` (`type: 'home'`)
now renders `data-page-type="home"`, the `home` max-width and its page title;
record pages are unchanged.
