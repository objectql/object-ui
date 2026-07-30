---
"@object-ui/core": minor
"@object-ui/components": patch
---

fix(sdui): a `kind:'html'` page can use lazily-registered blocks, and recovers when one registers late

objectui#2953 had a twin one tier over, unreported. The whitelist a
`kind:'html'` page's source compiles against was built from `getAllTypes()` +
`getConfig()` — both loaded-only — so any block registered via `registerLazy()`
was rejected as *"not an allowed component"*.

The blast radius is worse than the react tier's. There, a missing block cost one
identifier; here a compile diagnostic fails the **whole page**, so a single
`<object-kanban>` replaced the entire page with `HTML page failed to compile (2)`.
And it never recovered: `layoutElement` was memoised on `[schema, pageType]` with
no registry signal, so the cached error panel outlived the plugin actually
landing — permanently broken for the session.

`ComponentRegistry` gains three lazy-aware reads:

- `getKnownTypes()` — loaded registrations **plus** pending lazy stubs, deduped.
  The set a whitelist or manifest should be built from. `getAllTypes()` keeps its
  loaded-only meaning ("what can render right now") and now says so.
- `getMeta(type, namespace?)` — metadata from the loaded registration, else from
  a pending stub. `getConfig()` stays loaded-only, since callers read
  `.component` off it.
- `getVersion()` — monotonic counter of changes to the known set, bumped on
  register / unregister / registerLazy. A cache key that a type *count* cannot
  substitute for: one registration plus one unregistration leaves the count
  untouched while the set changed.

`getJsxManifest()` builds from those, and `PageRenderer` subscribes to the
registry so a page that could not compile retries when the registry grows.

A stub carries no `inputs` yet, so its props surface as `unknown-prop` warnings
rather than errors — the page compiles and renders, and the inner
`SchemaRenderer` triggers the loader and swaps in the real block. Authoring-time
prop validation is unaffected: `sdui.manifest.json` is generated with every
plugin eagerly loaded, and asserts as much.
