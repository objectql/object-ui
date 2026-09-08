# @object-ui/cli

## 17.7.0

### Minor Changes

- 7dc08a3: `objectui check` recognises a schema by validating it, and reports broken ObjectUI files instead of filing them as foreign ones.
  
  A file with a root `type` was judged only when its root carried an ObjectUI
  structural key (`children`, `body`, `className`, …). Leaf schemas carry only
  their own vocabulary, so nothing checked them: measured on this repository, 475
  files were eligible, 166 were judged and 309 were skipped.
  
  The command now has a second recogniser arm — the document validates as an
  ObjectUI component schema under `@object-ui/types`' own Zod union — which the
  maintainer's 2026-08-25 ruling selected over shipping a JSON Schema artifact to
  point a `$schema` URL at. It admits 209 of those 309 files. The structural arm
  still runs first, so recognition costs nothing for files that already had a
  marker, and `package.json` is still never judged: `"type": "module"` names no
  component the protocol models.
  
  Validity alone would have answered two different questions with one word.
  A broken ObjectUI schema fails validation exactly as a foreign file does, so a
  two-bucket report would have filed it as "not ObjectUI" — and the symptom of
  that is an absence: the file simply stops being mentioned. Measured, that bucket
  is not empty: 54 files land in it and 53 of them are real corpus content.
  
  So files the recogniser refuses are split. When the root `type` names a
  component this build registers, the file is **listed by name** as ObjectUI
  content that did not validate, pointing at `objectui validate <file>` for the
  reason — either the document is off-spec or its component type is not modelled
  by `@object-ui/types`. Everything else is counted as skipped, as before. The
  printed explanation now describes both arms, and only unreadable JSON still
  makes the command exit non-zero.
- a5d5547: `objectui validate` now prints the failing union arm the document selected, instead of a
  bare "Invalid input" (objectui#7004, maintainer ruling 2026-09-02 — option B).
  
  `safeValidateSchema` checks a document against `AnyComponentSchema`, a `z.union`. When a
  document matches no arm, Zod reports ONE top-level issue — `invalid_union` · `Invalid
  input` · path `(root)` — and hangs every arm's real diagnosis off that issue's `errors`
  array, which nothing read. So a menu whose item used the divider spelling retired in
  objectui#6523 printed a bare verdict on the whole document, while the remediation text
  objectui#6931 wrote into that arm sat one level down, unreachable.
  
  **What is printed now.** When the top-level issue is a failing union:
  
  - the document's `type` selects exactly one arm ⇒ that arm's issues are printed beneath
    the entry as `1.1`, `1.2` … with their real paths (`Path: items → 0 → type`) and codes,
    and **nothing** from the other arms;
  - no arm accepts the `type` ⇒ `No arm accepts type "dropdwn-menu".` plus the nearest few
    of the accepted values, ranked by edit distance and **capped** at five
    (`MAX_UNION_ARMS_REPORTED`);
  - the document declares no `type` at all ⇒ the note says so and offers no candidates —
    "nearest" needs something to be near, and an alphabetical slice of 108 arm names
    presented as guidance would be a bogus suggestion;
  - a union with no `type` discriminator to select on — `MenuItemSchema`, whose two arms
    both declare `type` as an ADR-0049 retirement tombstone — reports every arm, labelled
    and capped by the same constant. This is the path that finally delivers the
    objectui#6523 text to the author.
  
  Printing EVERY arm was rejected in the ruling: `AnyComponentSchema` resolves to 108 leaf
  arms, so one mistyped `type` would have produced hundreds of lines.
  
  `objectui check` is unchanged and deliberately so: it has no zod-issue printer, using
  `safeValidateSchema(...).success` as a boolean recogniser. Printing issues behind a
  *negative* recognition would flood its report with diagnoses of non-ObjectUI files, the
  failure objectui#5127 and objectui#6075 exist to prevent.
  
  Nothing about which documents are ACCEPTED changes — this is diagnostic output only.
- 94021dd: `objectui check` judges a file's `type` only when the file is recognisable as an ObjectUI schema, and reports how many it declined to judge.
  
  A root `type` was treated as a component key wherever it appeared. `type` heads at
  least seven unrelated JSON vocabularies, and the most common of them is
  `package.json`'s `"type": "module"` — so the first line a user saw running
  `objectui check` in their own project was a warning about their own package
  manifest. Measured at this repository's root: 46 warnings, 45 of them
  `package.json` (objectui#5127).
  
  A file now enters type judgement only when its root carries a structural key
  declared on `BaseSchema` — `children`, `body`, `className`, `placeholder`,
  `style`, the `visible`/`hidden`/`disabled` predicate family, `testId`,
  `ariaLabel`. Every other root-`type` vocabulary — JSON Schema's `"array"`, an
  `.eslintrc.json`'s `"commonjs"`, a package manifest's `"module"` — is simply
  never judged. The key set is read out of the node contract rather than invented,
  and it is closed: it grows only when `BaseSchema` grows.
  
  A list of filenames to exclude was the alternative and was rejected: it is a
  second hand-maintained list of the shape objectui#5115 had just finished
  deleting, and it can only ever enumerate the foreign vocabularies someone already
  thought of. This is a positive marker instead.
  
  Because the marker narrows what is checked, the command now also reports the
  count of files that had a root `type` and no marker, together with the marker
  keys that opt one back in. That number is the coverage this gate gives up until
  schema files are recognisable, and printing it is what keeps the loss visible
  rather than silent. The `.yaml`/`.yml` half of the scan is unchanged — it was
  never type-judged, before this change or after it. Exit codes are untouched: a
  JSON parse failure remains the only thing that fails the run.
  
  No public `$schema` URL is introduced. An earlier revision also admitted a file
  whose root `$schema` had an `objectui.org` host; the maintainer ruled against
  minting that identifier (2026-08-20, objectui#5127), so the structural key is the
  only marker. Because the matching was host-based rather than literal, that arm
  can be added later without invalidating a single file.

### Patch Changes

- 05474af: Fix `objectui check` scanning build output because its ignore list only excluded a
  root-level `dist/` / `node_modules/` (objectui#6320).
  
  `packages/cli/src/commands/check.ts` passed `ignore: ['node_modules/**', 'dist/**',
  '.git/**']` to `globSync`. `glob` matches `ignore` patterns against the path relative to
  `cwd`, so an unanchored `dist/**` / `node_modules/**` excludes only a directory of that
  name at the scan root — every nested `packages/<name>/dist/`, `examples/<name>/dist/`,
  `apps/<name>/dist/` (and their `node_modules/`) was still scanned. In a built workspace
  this means `objectui check` re-reads the author's own schemas a second time from build
  output, roughly doubling every count it reports (measured on this repository: 617 → 1047
  files globbed after a full build) with nothing in the output explaining why.
  
  The ignore patterns are now anchored at every depth (`'**/dist/**'`, `'**/node_modules/**'`),
  matching the fix's stated intent: exclude build output and installed dependencies wherever
  they live, not only at the project root. A root-level `dist/` / `node_modules/` remains
  excluded, unchanged.
  
  Confirmed before widening: no example, template, or docs fixture in this repository
  authors a schema under a directory literally named `dist` — the widened pattern excludes
  only generated content.
- 854222c: `@object-ui/plugin-report` now registers its three components under namespace
  **`plugin-report`**, the spelling its consumers already declare (objectui#6416).
  
  It used to register `report`, `spec-report` and `report-viewer` under namespace
  `report`, while `apps/console` declared the lazy stubs for the same three short
  names under `plugin-report` and the CLI's known-type whitelist shipped the
  `plugin-report:*` spellings as renderable. Two things followed from the
  disagreement:
  
  - **`plugin-report:report`, `plugin-report:report-viewer` and
    `plugin-report:spec-report` could never be satisfied.** `Registry.register`
    clears the lazy stub for the type IT registers, and that type was
    `report:report`, so those three stubs were never cleared and no component was
    ever stored under them: `get('report', 'plugin-report')` returned `undefined`
    and `hasLazy('report', 'plugin-report')` stayed `true` forever. A schema
    authored with any of the three whitelisted keys resolved to nothing — the
    gate handed authors a green light for a key the runtime could not satisfy.
  - **The bare `report` key was claimed twice under two different namespaces.**
    `Registry.register` and `Registry.registerLazy` share the
    `meta?.namespace && !meta?.skipFallback` branch, so what bare `report`
    *declared* depended on whether the plugin chunk had loaded yet — the
    objectui#6353 shape.
  
  **No authored metadata changes.** The direction was chosen by measurement:
  nothing in this repository, and nothing in the sibling `objectstack` checkout,
  authors a `report:*` spelling (0 hits), while the bare spellings are authored in
  48 places. `type: 'report'`, `type: 'spec-report'` and `type: 'report-viewer'`
  resolve exactly as before; the three unreachable `report:*` keys are retired and
  the three `plugin-report:*` keys now name real components for the first time.
  
  `packages/cli/src/utils/known-schema-types.ts` is regenerated from the
  registrations, dropping `report:report`, `report:report-viewer` and
  `report:spec-report`.
  
  Two pins are the half that outlives the fix:
  `packages/plugin-report/src/__tests__/report-bare-key-ownership.test.ts` replays
  this package's real declared metadata and a console-shaped lazy stub into a
  fresh `Registry` in **both** registration orders, checking the bare key's
  declared namespace after every step, so order- and phase-independence are
  properties under test rather than properties of the file the test imports.
  `scripts/__tests__/report-namespace-agreement-6416.test.ts` re-derives both
  sites from source and fails if the plugin, the console stubs and the generated
  whitelist ever disagree again.
- 85b4957: `objectui validate` now says when a validation issue sits at the document root
  (objectui#7004, mechanical half).
  
  The printer guarded its Path line with `issue.path.length > 0`, so an issue at
  `path: []` printed no Path line at all — silent in exactly the case a reader
  most needs oriented. That case is the common one, not an edge: the CLI validates
  against `AnyComponentSchema`, a union over every component arm, so any document
  matching no arm reports a single top-level issue (`invalid_union` · `Invalid
  input` · root path). Authors saw a bare verdict on a whole document with nothing
  saying which node had been judged:
  
  ```
  1. Invalid input
     Code: invalid_union
  ```
  
  Every reported issue now carries a Path line; a root-level one reads
  `Path: (root)`, parenthesised so it cannot be mistaken for a real key named
  `root`. Non-root issues print their authored path exactly as before.
  
  Scope: the printer still reads only top-level issues. Whether a failing union
  should also surface its per-arm diagnoses — and if so which arm's — is an
  author-facing diagnostic contract left open on objectui#7004 for a maintainer
  ruling, and is deliberately not decided here.
- 639114c: Reconcile the declared surface with `@objectstack/spec` 17.3.0 (objectui#7122).
  
  ⚠️ **`@object-ui/types` is graded `minor` for a breaking surface change.**
  The exported `ObjectSchemaClientExtensions` narrows from
  
  ```ts
  export interface ObjectSchemaClientExtensions { editMode?: 'modal' | 'page' }
  ```
  
  to
  
  ```ts
  export type ObjectSchemaClientExtensions = Record<never, never>;
  ```
  
  Two breaking consequences for a consumer that names the type directly. **(1)** It
  no longer declares `editMode`; the key is now carried by the spec's
  `ServiceObject`, so `ObjectSchemaMetadata` still has it, but code written against
  the extension type ALONE loses it. **(2)** `interface` → type alias also ends
  **declaration merging**: a consumer that reopened
  `declare module '@object-ui/types' { interface ObjectSchemaClientExtensions { … } }`
  to add its own client-side member no longer compiles, because an alias cannot be
  reopened. `minor` rather than `major` per `AGENTS.md`'s version-alignment rule —
  objectui's own breaking changes are graded `minor` with the semantics stated in
  the body, since any `major` in the fixed group would push all 39 packages off
  `@objectstack`'s major.
  
  **`ObjectSchema.editMode` is now the spec's.** 17.3.0 adopted the key (measured:
  the accept set went 42 → 43, gained set exactly `['editMode']`, lost set empty,
  declared as the same `'page' | 'modal'` union objectui carried). Its local copy
  is retired from `ObjectSchemaClientExtensions`, which is what that type's own pin
  prescribed for this event, leaving the client delta empty. Nothing is removed
  from the product: `editMode` stays authorable and stays typed on
  `ObjectSchemaMetadata`, carried by the spec's `ServiceObject` instead of by a
  local member — and a published, spec-validated object document may now carry it,
  which at 17.2.0 was refused by name.
  
  **`user:profile` is retired across all three sites.** 17.3.0 dropped it from
  `PageComponentType` (measured: the enum went 34 → 32 options, lost set exactly
  `['user:profile', 'element:form']`, gained set empty). objectui went on knowing
  it in three places, so all three moved together: the Studio palette exclusion
  ledger, `PROTOCOL_COMPONENTS` in `renderers/placeholders.tsx`, and the
  regenerated `known-schema-types.ts` the CLI checks schemas against. Nothing
  user-reachable went with it — neither type had a renderer, `user:profile` had
  only the dashed "Component Placeholder" scaffold, and the app shell's own
  profile affordance is a React slot, never this block type. A page schema still
  naming it now draws the loud "Unknown component type" panel rather than a silent
  grey box, which is this repo's standing treatment for a type outside the
  supported surface.
  
  **`record:details` sections document the eight keys 17.3.0 added.**
  `group`, `hideEmpty`, `collapsible`, `showBorder`, `defaultCollapsed`, `icon`,
  `description` and `headerColor` are now declared on a section entry (4 → 12
  members). Six of the eight are already honoured by `DetailSection`, so the
  `sections` input description now teaches all of them, and says plainly which two
  are not read here. Designer controls for them are a separate feature and are
  deliberately not added.
  
  **`@object-ui/types` raises its declared `@objectstack/spec` floor `^17.0.0` →
  `^17.3.0`, and this is the second half of its `minor`.** The package's emitted
  `dist/spec-report.d.ts` names `FilterCondition` from `@objectstack/spec`, which
  `17.0.0` does not export, so the old range was a claim the artifact did not
  support — `scripts/check-spec-range-floors.mjs` reports it as `[floor-too-low]`
  and names `^17.3.0` as the lowest version carrying every symbol the package
  references. Breaking for a consumer pinned below 17.3.0: it can no longer
  resolve this package. That is the range stating the truth rather than a new
  restriction — the artifact already required those symbols — and it is the
  remedy the gate itself prescribes ("Raise that package's range to the lowest
  version that exports the symbol… Do not add a tolerant re-declaration on this
  side: the range is the claim, and the claim is what is wrong", objectui#5793).
  `@object-ui/core` and `@object-ui/data-objectstack` already declare `^17.2.0`
  and `@object-ui/plugin-detail` `^17.1.0`, so a floor above the family minimum is
  this repo's normal state, not an exception.
  
  ⚠️ **Measured on both sides, because it is bump-caused rather than pre-existing
  and objectui#7688 records the opposite.** The gate is a scheduled / push-to-main
  workflow that cannot red a pull request, and `main` is green on it — the last
  eight runs, most recently at `c2e3cee2c`. On this branch's built tree it exits 1
  with CI's own `--cross-check` invocation, and exits 0 with this raise, judging
  278 (subpath, symbol) pairs across 19 published packages either way. Its blocking
  copy runs on the publish path, so leaving it would have surfaced as a cancelled
  release rather than as a red check. The correction is recorded on objectui#7688.
- 100547e: `objectui validate` now refuses a form field whose widget id names a namespace
  other than `field:`, matching the verdict `@object-ui/core`'s `validateSchema`
  has given since objectui#5375 (objectui#5449).
  
  The CLI reaches `FormFieldSchema` through `safeValidateSchema`, and that schema
  declared `type` and `widget` as bare optional strings — so a field typed
  `ui:password` validated clean while the runtime validator rejected the same
  document with `UNRESOLVABLE_FIELD_WIDGET_NAMESPACE`. The CLI is the surface an
  author actually runs before shipping, so it was the one handing out the false
  green: an author did exactly the diligence objectui#5375 asks for and still
  shipped metadata that renders a secret into a plain text box.
  
  A `superRefine` on `FormFieldSchema` now states the rule, mirroring core's
  precedence (`widget` before `type`), the key it blames, its error code and its
  message verbatim, so the two entry points cannot describe one defect two ways.
  
  **This rejects documents that previously validated.** Only colon-qualified
  field widget ids outside the `field:` namespace are affected — `field:`-prefixed
  ids and bare names such as `password` still pass, registered or not. A field
  carrying, say, `type: 'ui:password'` must be rewritten as `password` or
  `field:password`; it never rendered as a password box in any case.
  
  Which of the repo's authoring-time validators is canonical remains open
  (objectui#4631) — this states the rule on the zod side rather than unifying
  them.
- d91aed9: Name the case-only spelling when a component type misses the registry.
  
  Registry lookup is exactly case-sensitive, so a node typed `Page` misses a registered `page` and falls through to the OBJUI-001 "Unknown component type" panel. Because the mistake is usually uniform across a document, the symptom is not one broken widget — it is the whole page rendering as error panels, with nothing in the message pointing at the cause.
  
  Both surfaces that report the miss now name the spelling that would have resolved. `SchemaRenderer`'s panel reads `Unknown component type: Page — did you mean 'page'?`, and `objectui check` reports `Unknown schema type "Page" in <file> — did you mean "page"?`. When no known type differs by case alone, neither says anything extra — `zzz` gains no bogus suggestion, and this is case matching, not an edit distance, so `pge` suggests nothing either.
  
  **Lookup itself does not change.** `Page` still misses, still fails, and still renders the panel; only the message teaches. Normalising the lookup was considered and rejected (objectui#5247, maintainer ruling 2026-08-19): it would make two spellings valid everywhere, permanently, and legalise the typo class (`PAGE`, `pAge`) along with the PascalCase convention.
  
  Each surface reads its candidates from the set it can actually trust — the renderer from the live `ComponentRegistry` (including pending lazy stubs), the CLI from the registration-derived `KNOWN_SCHEMA_TYPES` snapshot — so neither can suggest a type nothing registers.
- Updated dependencies [06a8af5]
- Updated dependencies [6a91586]
- Updated dependencies [a04d7c6]
- Updated dependencies [460575f]
- Updated dependencies [d796c8d]
- Updated dependencies [1b1d772]
- Updated dependencies [d88e20f]
- Updated dependencies [2d7304d]
- Updated dependencies [636b236]
- Updated dependencies [4172589]
- Updated dependencies [64d624d]
- Updated dependencies [39f4309]
- Updated dependencies [d2fb6ef]
- Updated dependencies [7cd3987]
- Updated dependencies [e304a4e]
- Updated dependencies [fc62bb4]
- Updated dependencies [41df893]
- Updated dependencies [00f3eb5]
- Updated dependencies [1ec291c]
- Updated dependencies [453dbaa]
- Updated dependencies [f8cdbf2]
- Updated dependencies [69a2163]
- Updated dependencies [24e027e]
- Updated dependencies [2c3cd1b]
- Updated dependencies [e176053]
- Updated dependencies [e30ed15]
- Updated dependencies [90665e0]
- Updated dependencies [194fae1]
- Updated dependencies [7e19d03]
- Updated dependencies [546ddf7]
- Updated dependencies [864154e]
- Updated dependencies [b023625]
- Updated dependencies [75bd83d]
- Updated dependencies [40c479a]
- Updated dependencies [971d387]
- Updated dependencies [ee851c3]
- Updated dependencies [6414dfd]
- Updated dependencies [a8d5c71]
- Updated dependencies [905b21f]
- Updated dependencies [88e9109]
- Updated dependencies [2c45966]
- Updated dependencies [db3a600]
- Updated dependencies [6fd2cf7]
- Updated dependencies [52a43de]
- Updated dependencies [e4559d1]
- Updated dependencies [2c71482]
- Updated dependencies [129bcc5]
- Updated dependencies [5ef9c4f]
- Updated dependencies [46f0bb4]
- Updated dependencies [8ec11e1]
- Updated dependencies [6f81384]
- Updated dependencies [22ba927]
- Updated dependencies [f8c70f4]
- Updated dependencies [8f1d995]
- Updated dependencies [f9c34df]
- Updated dependencies [dddb942]
- Updated dependencies [29754cf]
- Updated dependencies [6e88630]
- Updated dependencies [b84dc18]
- Updated dependencies [ac8abb0]
- Updated dependencies [9d86e1d]
- Updated dependencies [99a3c2d]
- Updated dependencies [f24de8b]
- Updated dependencies [c8ea8af]
- Updated dependencies [3190414]
- Updated dependencies [4e480f5]
- Updated dependencies [38a123c]
- Updated dependencies [30c73cd]
- Updated dependencies [830ed58]
- Updated dependencies [d7acad6]
- Updated dependencies [45a9aeb]
- Updated dependencies [713db46]
- Updated dependencies [c71e14d]
- Updated dependencies [bf3a03c]
- Updated dependencies [748494b]
- Updated dependencies [5967be0]
- Updated dependencies [29cb85b]
- Updated dependencies [3e028c8]
- Updated dependencies [ce503e5]
- Updated dependencies [f20dcf0]
- Updated dependencies [12402a9]
- Updated dependencies [aff3d7a]
- Updated dependencies [4ca30d0]
- Updated dependencies [7a5da14]
- Updated dependencies [2c1c967]
- Updated dependencies [9486ac6]
- Updated dependencies [9486ac6]
- Updated dependencies [d6ceb8d]
- Updated dependencies [dc4365c]
- Updated dependencies [e321d52]
- Updated dependencies [4c68077]
- Updated dependencies [7977ff9]
- Updated dependencies [3beef6d]
- Updated dependencies [06b8c42]
- Updated dependencies [46b9bc9]
- Updated dependencies [b97790a]
- Updated dependencies [7c9b044]
- Updated dependencies [d47de51]
- Updated dependencies [3fe6463]
- Updated dependencies [31ab372]
- Updated dependencies [846889b]
- Updated dependencies [26896c6]
- Updated dependencies [67fc3b0]
- Updated dependencies [33a3b3c]
- Updated dependencies [b87f15b]
- Updated dependencies [c18d099]
- Updated dependencies [adb2a86]
- Updated dependencies [03380aa]
- Updated dependencies [3561bd2]
- Updated dependencies [bf97b98]
- Updated dependencies [b0d308d]
- Updated dependencies [8063bcb]
- Updated dependencies [b74a859]
- Updated dependencies [d4493fd]
- Updated dependencies [240b80f]
- Updated dependencies [77cb489]
- Updated dependencies [bfaa158]
- Updated dependencies [777e5c6]
- Updated dependencies [0c386dd]
- Updated dependencies [9e37d9b]
- Updated dependencies [5ad86dd]
- Updated dependencies [16a725f]
- Updated dependencies [4dfdcc3]
- Updated dependencies [6a449fc]
- Updated dependencies [446d93d]
- Updated dependencies [ecd9cb2]
- Updated dependencies [98d4108]
- Updated dependencies [0e3b3be]
- Updated dependencies [00d3f09]
- Updated dependencies [4388f71]
- Updated dependencies [c93b4d5]
- Updated dependencies [c1fe272]
- Updated dependencies [8ad218d]
- Updated dependencies [5f78953]
- Updated dependencies [639114c]
- Updated dependencies [1f31d3a]
- Updated dependencies [d1842ab]
- Updated dependencies [78ca238]
- Updated dependencies [351eb31]
- Updated dependencies [20c04b2]
- Updated dependencies [b652514]
- Updated dependencies [adbda1b]
- Updated dependencies [adbda1b]
- Updated dependencies [2e32ed4]
- Updated dependencies [7c3df8f]
- Updated dependencies [b9f5ff1]
- Updated dependencies [4704aa4]
- Updated dependencies [858cd72]
- Updated dependencies [554f2b6]
- Updated dependencies [26e06d7]
- Updated dependencies [669d71b]
- Updated dependencies [ed27d7c]
- Updated dependencies [52c8cf7]
- Updated dependencies [52c8cf7]
- Updated dependencies [7bf244b]
- Updated dependencies [f0bb9fa]
- Updated dependencies [81a2eb1]
- Updated dependencies [c6198c2]
- Updated dependencies [2f61238]
- Updated dependencies [51eb515]
- Updated dependencies [c354ce5]
- Updated dependencies [8fe8e5c]
- Updated dependencies [9587fc9]
- Updated dependencies [e62c44e]
- Updated dependencies [daf9d57]
- Updated dependencies [c15d7ec]
- Updated dependencies [5d0876c]
- Updated dependencies [f7ace0a]
- Updated dependencies [b041b9c]
- Updated dependencies [2ce2612]
- Updated dependencies [bc640ec]
- Updated dependencies [3e377c9]
- Updated dependencies [a3eb5d0]
- Updated dependencies [4ce14f1]
- Updated dependencies [2af1fa7]
- Updated dependencies [c14d3a0]
- Updated dependencies [caf477f]
- Updated dependencies [f6375da]
- Updated dependencies [967e5d8]
- Updated dependencies [a4611b3]
- Updated dependencies [20316ba]
- Updated dependencies [d3499b3]
- Updated dependencies [18897a4]
- Updated dependencies [8b7ea39]
- Updated dependencies [64a252d]
- Updated dependencies [d1bebb0]
- Updated dependencies [4f9f1ee]
- Updated dependencies [c842594]
- Updated dependencies [cf1d29e]
- Updated dependencies [0ea7054]
- Updated dependencies [6bca0e4]
- Updated dependencies [3c76801]
- Updated dependencies [2fcefb9]
- Updated dependencies [b55a346]
- Updated dependencies [065bba7]
- Updated dependencies [dd19463]
- Updated dependencies [100547e]
- Updated dependencies [6d1c155]
- Updated dependencies [d7573b3]
- Updated dependencies [2c8474c]
- Updated dependencies [0e05aac]
- Updated dependencies [ae61ad4]
- Updated dependencies [18a8e7d]
- Updated dependencies [e7957ab]
- Updated dependencies [f7e34ca]
- Updated dependencies [e719ebd]
- Updated dependencies [f9e4f91]
- Updated dependencies [fa429cf]
- Updated dependencies [ed8df3e]
- Updated dependencies [fe76ece]
- Updated dependencies [58770f3]
- Updated dependencies [aefe428]
- Updated dependencies [485f096]
- Updated dependencies [199d31b]
- Updated dependencies [b655a9d]
- Updated dependencies [3e01cb5]
- Updated dependencies [4e8622b]
- Updated dependencies [dffd752]
- Updated dependencies [105f3c5]
- Updated dependencies [3ccd9e8]
- Updated dependencies [689b979]
- Updated dependencies [e546222]
- Updated dependencies [fd13f52]
- Updated dependencies [d7bd274]
- Updated dependencies [98c3a74]
- Updated dependencies [ebce5a3]
- Updated dependencies [9d9040d]
- Updated dependencies [0fce2ef]
- Updated dependencies [9850c6e]
- Updated dependencies [b2ea297]
- Updated dependencies [5b5a5c3]
- Updated dependencies [ab92940]
- Updated dependencies [a691c0b]
- Updated dependencies [0b1326d]
- Updated dependencies [515f171]
- Updated dependencies [4f14ad7]
- Updated dependencies [258d264]
- Updated dependencies [cac64b3]
- Updated dependencies [fa140b8]
- Updated dependencies [71cba28]
- Updated dependencies [190fbd0]
- Updated dependencies [72ffc34]
- Updated dependencies [bf28341]
- Updated dependencies [78cbdb5]
- Updated dependencies [b7543a9]
- Updated dependencies [6c6cee7]
- Updated dependencies [42887e0]
- Updated dependencies [83fe6e7]
- Updated dependencies [d1ab06f]
- Updated dependencies [f90b8fb]
- Updated dependencies [91783c4]
- Updated dependencies [dba7d84]
- Updated dependencies [5a07e67]
- Updated dependencies [45d8288]
- Updated dependencies [490f482]
- Updated dependencies [27308c5]
- Updated dependencies [8689166]
- Updated dependencies [c9327c9]
- Updated dependencies [920165d]
- Updated dependencies [9101be5]
- Updated dependencies [f53a8d0]
- Updated dependencies [57f9b07]
- Updated dependencies [3c73d99]
- Updated dependencies [d91aed9]
- Updated dependencies [c86185e]
- Updated dependencies [1170ed1]
- Updated dependencies [4d73b07]
  - @object-ui/types@17.7.0
  - @object-ui/components@17.7.0
  - @object-ui/react@17.7.0

## 17.6.0

### Patch Changes

- 195b9e4: The routed temp app's generated manifest now asks for the same `lucide-react` range this repo installs.
  
  `utils/app-generator.ts` writes the routed variant's `dependencies` with two
  quoted third-party ranges, and `lucide-react` had fossilised a minor behind the
  22 sibling manifests that declare it: the generated manifest said `^1.29.0`
  while the repo had moved to `^1.31.0`. A generated app therefore asked npm for
  an icon library older than the one every `@object-ui/*` package it installs
  alongside was built against.
  
  The drift was not silent — `app-generator.test.ts` derives its expectation from
  the in-repo range precisely so a bump on one side and not the other fails a
  test, and both of its pins were red. What went wrong is that they went red too
  late to stop anything: the dependency PR that moved the repo range merged while
  those shards were still running, so the failure surfaced on `main` and then on
  the merge ref of every unrelated open PR. The range is now caught up; the
  reporting hole and the merge-ordering hole are filed separately (objectui#4968).
  
  The remaining eleven anchored ranges were swept against the same dependabot
  batch and are all in sync, so this is the batch's only consumer-side follow-up.
  Deriving the value from the workspace instead of quoting it was considered and
  rejected: nine of the thirteen anchored ranges quote the repo root manifest,
  which is not published with this CLI, so no single derivation can serve the
  table and a bespoke one for this one name would leave the class untouched.
- 68d9e28: `objectui check`: the known-type list is now derived from the component registry instead of being a hand-written copy, which had drifted in both directions at once.
  
  The command judged a schema's `type` against a seventeen-entry array typed by
  hand into `packages/cli/src/commands/check.ts`. Nothing held that array against
  the registry, and measured on `origin/main` @ `8378e9954` it was wrong in both
  directions simultaneously:
  
  - **Two phantoms.** `crud` and `gallery` were on the list and are registered by
    nothing. `objectui check` passed `{ "type": "crud" }` in silence while
    `SchemaRenderer` painted the OBJUI-001 "Unknown component type" panel for the
    very same file — measured, both halves. `CRUDSchema` still has its interface,
    zod mirror, validator branch and builder; what it has never had is a
    registration. For `gallery`, the registered spelling is `object-gallery`.
  - **221 bare keys missing, plus every namespaced spelling.** `object-grid`,
    `object-form`, `card`, `div` and `view:grid` were all reported as
    `⚠️ Unknown schema type`. False warnings at that volume are not a cosmetic
    problem: they train authors to skip the output, which costs the phantom
    direction its only reader.
  
  The list now lives in `packages/cli/src/utils/known-schema-types.ts`, generated
  by `node scripts/regenerate-known-schema-types.mjs` from the same
  `deriveRegistryKeys` derivation that judges documentation snippets, and held to
  it by a bidirectional pin in
  `scripts/__tests__/known-schema-types-derivation-5115.test.ts` — a key the
  registry has and the list lacks fails, and so does a key the list has and the
  registry lacks. Bare and namespaced spellings are both carried, because
  `register('grid', C, { namespace: 'view' })` really does store both.
  
  A runtime lookup through `ComponentRegistry` was measured and rejected: eleven
  of the fifteen genuinely-registered entries come from plugin packages the CLI
  does not depend on, and a published CLI runs against a user project whose plugin
  set this repository cannot know either way.
  
  **Behaviour change, in both directions.** `{ "type": "crud" }` and
  `{ "type": "gallery" }` now produce the `Unknown schema type` warning they
  always should have, and a large number of real component types stop producing
  one. The warning remains advisory — it never changes the command's exit code,
  which is still driven only by files that fail to parse — so no run that passed
  before fails now.
  
  `check()` additionally takes the directory to scan as an optional argument
  (defaulting, as before, to `process.cwd()`), so the behaviour can be tested
  against a fixture tree.
- e6a8960: `objectui check` reads `.json` as JSONC, so a `tsconfig.json` no longer fails the run.
  
  `check` globbed every `**/*.{json,yaml,yml}` and handed each `.json` straight to
  `JSON.parse`. A throw there is the only thing that increments the error count, and
  a non-zero error count is the only thing that calls `process.exit(1)` — so a `//`
  comment or a trailing comma, which is how TypeScript documents `tsconfig.json`,
  was reported as a malformed file and **failed the command**. Every TypeScript
  project hit this: `objectui check` exited 1 for anyone who ran it, and at this
  repository's own root it reported 64 errors, all of them `tsconfig*.json`
  (objectui#5237).
  
  `.json` on disk means JSONC in practice — `tsconfig.json`, `.eslintrc.json`,
  `devcontainer.json` and VS Code's own settings are all written that way — so the
  file is now read with `jsonc-parser`, which permits comments and trailing commas.
  No new package enters what users install: `jsonc-parser` is already a runtime
  dependency of `@object-ui/app-shell`, it is already at the version the lockfile
  resolves, and it declares no dependencies of its own.
  
  The reader is a real JSONC parser and **not** a comment-stripping regex, because
  a `//` inside a string value — a URL, say — is not a comment, and a stripper that
  cannot tell the difference corrupts valid files instead of reading them.
  
  Genuinely malformed JSON still errors and still exits 1. That needed saying in
  code as well as in tests: `jsonc-parser`'s reader is error-tolerant and returns a
  best-effort value rather than throwing, so the command consults its reported-error
  array instead of inferring success from the absence of a throw. Error output now
  names the reason and the line and column.
  
  The unknown-schema-type warning arm is deliberately untouched: it still warns, and
  it still does not affect the exit code. Files that previously died at the parse
  step now reach it, so a JSONC file carrying an unrecognised root `type` warns
  where it used to error — the verdict and the exit-code neutrality are unchanged.
- 51e65d4: `dev`, `serve` and `build` accept the documented directory argument from anywhere, and refuse a non-project directory in plain language.
  
  `content/docs/utilities/cli.mdx` has recorded the positional argument as "Path
  to JSON/YAML schema file or `pages/` directory" and printed `objectui dev
  pages/` as the file-system-routing example. That promise had never actually been
  parsed. Detection's first step required `statSync(...).isFile()`, so a directory
  argument fell straight through it; the one spelling that worked — `objectui dev
  pages/` from inside the project — worked by coincidence of position, caught by
  the working-directory fallback rather than read as an argument. Every pathful
  spelling reached single-schema mode and handed a directory to `readFileSync`:
  
  ```
  $ objectui dev my-app/pages
  Error: Invalid schema file: EISDIR: illegal operation on a directory, read
  ```
  
  A directory argument now resolves through file-system routing in the shared
  resolution step the three commands were centralized on (objectui#4923), in
  either of the two shapes a user can mean: the directory **is** a `pages`
  directory, or it **contains** one. Both produce the same routed answer as naming
  the app config beside them — same project root, same routes, same app config —
  so `objectui dev my-app/pages`, `objectui dev my-app` and `objectui dev
  my-app/app.json` agree, from any working directory, across all three commands.
  The limb lives in the shared resolver, not in three command branches.
  
  The remaining directory-shaped miss is now diagnosed instead of leaking a
  `readFileSync` errno: a directory that is neither shape is refused by name,
  saying what would have been accepted. The refusal sits **after** the
  working-directory fallback, so nothing that resolves today stops resolving: this
  change accepts strictly more than before and rejects nothing that worked.
- bbfbc54: `objectui serve` and `objectui build` now locate the project the way `dev` does, instead of looking only in the current directory.
  
  For a project with an app config and a `pages/` directory beside it, the three
  commands answered one invocation two different ways. `dev` anchored on the
  schema argument — `dirname(<schema>)` is the project root, `pages/` beside it
  means file-system routing, the named file is the app config. `serve` and `build`
  looked for a `pages/` directory in the current working directory and nowhere
  else, so from any directory above the project they fell through to single-schema
  mode and handed the app config to the renderer as if it were a page.
  
  Measured on the reported fixture (`<root>/app.json` + `<root>/pages/index.json`,
  invoked from the directory above): `dev` reported the project and one route,
  `serve` reported `Loading schema: <root>/app.json`, and `build` did the same and
  **exited 0** — the emitted bundle embedded the app config as the page schema and
  contained no page from `pages/` at all. A wrong artifact, produced silently.
  
  The detection now lives in one helper the three commands share
  (`utils/project-source.ts`), resolving in a fixed order: a `pages/` directory
  beside the schema argument, else one under the current directory, else
  single-schema mode. `serve` and `build` also pass the resolved app config to the
  routed app generator, which they never did, so a routed project keeps its layout
  under all three commands.
  
  A lone schema file with no `pages/` beside it is unchanged — that is the
  fallback, and it is still a supported way to run.
- 82fbc09: `objectui serve` gains `--no-open`, matching the flag `objectui dev` already ships, and no
  longer prints a bare `Error: spawn xdg-open ENOENT` stack after its success banner in a
  headless environment.
  
  **`--no-open`.** `serve` hardcoded Vite's `open: true` and its only options were
  `--port`/`--host` — `dev` already had `--no-open` (`options.open !== false`), so the same
  invocation behaved inconsistently across the two commands. `serve` now threads the same
  flag the same way; the default is unchanged — with the flag omitted, `serve` still opens a
  browser exactly as it always has (objectui#4924).
  
  **The headless spawn failure.** Vite's own browser-open step already catches a failed
  `open(url)`, but reports it via `logger.error(err.stack || err.message)` with no
  `{ timestamp: true }`, so the default logger prints the bare Node `ChildProcess` stack with
  no `[vite]` prefix and no context — and because that promise chain is fire-and-forget from
  `server.listen()`, it lands *after* the "✓ Server started successfully!" banner, reading
  like a crash even though the server is fine. There's nothing in `serve.ts` to try/catch —
  the error never leaves Vite. `serve` now supplies a `customLogger` that wraps Vite's default
  logger and replaces exactly that message with a short, contextual line naming the missing
  opener binary (`(could not open the browser automatically — 'xdg-open' is not available in
  this environment; open the URL above manually)`); every other log call — including
  unrelated errors — passes through unchanged.
  
  Sibling card objectui#4923 (project-root detection on the same command) is intentionally
  untouched here; it is a separate defect with a separate PR.
- 4102bfc: Inside a pnpm workspace, `objectui dev` / `serve` / `build` now resolve every platform package
  from workspace source (objectui#3890).
  
  The temp app these commands generate installs nothing inside a workspace — it resolves by
  hoisting, and the repo root declares no `@object-ui/*` — so a Vite alias table is the only thing
  that resolves a platform package there. That table was a hand-kept list of eleven names in
  `dev`, which is not a list of what the app imports but of what it imports *transitively*:
  measured on the reported commit, the generated entry closes over 21 packages, ten were unlisted,
  and every module whose transform hit one of them answered 500 with a blank page behind it. Vite's
  dependency scan named only four of the ten, because a scan stops at the first layer it cannot
  resolve.
  
  The table is now derived from `pnpm-workspace.yaml` — every scoped workspace package that exposes
  a source barrel, targeting its `src` directory — and a test reconciles it against the manifest so
  it cannot drift again. `serve` and `build` had no workspace branch at all (no aliases, and an
  unconditional `npm install` against a manifest that is empty here); all three commands now share
  one helper. The `lucide-react` entry moved from a resolved entry file to the package root, so
  subpath imports of it stop being rewritten into a path that cannot exist.
  
  Measured with the reported repro, from the repo root: 8 of the first 400 modules a browser walk
  reaches answered 500 before, 0 of 2498 after, and the page renders its schema instead of nothing.
- Updated dependencies [88085e3]
- Updated dependencies [516663d]
- Updated dependencies [460c4d0]
- Updated dependencies [0ae27f7]
- Updated dependencies [78c0f9a]
- Updated dependencies [bbe8b86]
- Updated dependencies [279fb13]
- Updated dependencies [2e82ab2]
- Updated dependencies [40d3a33]
- Updated dependencies [8b9dc62]
- Updated dependencies [1184192]
- Updated dependencies [a2a9747]
- Updated dependencies [a1609a6]
- Updated dependencies [53f23bc]
- Updated dependencies [c4533dc]
- Updated dependencies [be60815]
- Updated dependencies [37f6844]
- Updated dependencies [93de4f6]
- Updated dependencies [2b50261]
- Updated dependencies [384f30d]
- Updated dependencies [ac600e5]
- Updated dependencies [97fba31]
- Updated dependencies [232f61a]
- Updated dependencies [d374caf]
- Updated dependencies [5673576]
- Updated dependencies [911ceaa]
- Updated dependencies [98eab36]
- Updated dependencies [af5e292]
- Updated dependencies [3fbbea1]
- Updated dependencies [7f96b10]
- Updated dependencies [167ec42]
- Updated dependencies [616a2a5]
- Updated dependencies [0046d8f]
- Updated dependencies [f1d4748]
- Updated dependencies [578e025]
- Updated dependencies [598c89a]
- Updated dependencies [4a0bd17]
- Updated dependencies [b8b9af4]
- Updated dependencies [8c0d52e]
- Updated dependencies [aff10e2]
- Updated dependencies [70a774b]
- Updated dependencies [7458a41]
- Updated dependencies [d971e51]
- Updated dependencies [97abb24]
- Updated dependencies [deb157a]
- Updated dependencies [d2ce342]
- Updated dependencies [9695da7]
- Updated dependencies [75444e3]
- Updated dependencies [58b8346]
- Updated dependencies [2d0bd16]
- Updated dependencies [dad51e5]
- Updated dependencies [1c9c342]
- Updated dependencies [787c738]
- Updated dependencies [8396656]
- Updated dependencies [dbbd38a]
- Updated dependencies [93fe362]
- Updated dependencies [dfc6975]
- Updated dependencies [3cf4de0]
- Updated dependencies [c9dc811]
- Updated dependencies [144ef9b]
- Updated dependencies [138ab04]
- Updated dependencies [a0b9e91]
- Updated dependencies [99bd015]
  - @object-ui/types@17.6.0
  - @object-ui/react@17.6.0
  - @object-ui/components@17.6.0

## 17.5.0

### Patch Changes

- 64cda47: Fix `objectui init`'s scaffold failing its own `npm run build`, and put the third generator under the real `tsc` gate

  The scaffold `objectui init` writes declares `"build": "tsc && vite build"`, so `tsc` runs on the way to a production build — and its `src/main.tsx` did `import './index.css'` with no ambient declaration behind it. Any user who followed the generated README (`objectui init`, then `npm run build`) got `TS2882: Cannot find module or type declarations for side-effect import of './index.css'` in a file the tool had just written for them, before Vite was ever reached.

  Fixed the same way objectui#3853 fixed the two temp-app generators: the scaffold now writes `src/vite-env.d.ts` (`/// <reference types="vite/client" />`), where the `declare module '*.css'` declarations live. `vite` was already in the scaffold's `devDependencies`, so nothing new is declared.

  Measured rather than assumed: this scaffold had that one error and none of the other four classes objectui#3853 found in the temp apps — those live in a `src/Layout.tsx` this scaffold does not have. The `tsc` gate in `app-generator.test.ts` now covers the init scaffold too, so the strictness its own `tsconfig.json` declares is enforced instead of decorative.

- 9b9fa49: Make the generated temp app pass the strict `tsconfig.json` the generator writes beside it, and gate it with a real `tsc`

  Both app generators (`createTempApp`, `createTempAppWithRouting`) emit a `tsconfig.json` carrying `strict`, `noUnusedLocals` and `noUnusedParameters`, but nothing had ever run it — `dev`/`serve`/`build` go through Vite, which transpiles without type-checking — so the generated sources had drifted 17 errors past their own declared config. A user who copies the temp app out as a scaffold, or runs `tsc` in it, met all 17 at once.

  Fixed at the templates: dropped five imports that were declared and never used (`Link` in `src/App.tsx`; `cn`, `Button`, `SidebarGroupContent`, `SidebarGroupLabel` in `src/Layout.tsx`), typed `DynamicIcon`'s and `AppLayout`'s props (which also types the `menu`/`children` map callbacks by inference, and makes `className` optional so the two call sites that omit it are legal), and added the `src/vite-env.d.ts` every Vite TS scaffold carries — without it the entry's `import './index.css'` has no declaration behind it, in both generators.

  The Lucide lookup no longer needs `@ts-expect-error`: the namespace is narrowed to the component-by-name shape the layout actually uses. No `any` was added.

  A real `tsc -p` over a generated app now runs in the package's tests, so the declared strictness is enforced rather than decorative.

- Updated dependencies [ceccdcf]
- Updated dependencies [d6e5124]
- Updated dependencies [debad27]
- Updated dependencies [dc2aa3e]
- Updated dependencies [ee26e65]
- Updated dependencies [f650253]
- Updated dependencies [3d9769a]
- Updated dependencies [8f85f8b]
- Updated dependencies [d0c3b26]
- Updated dependencies [4dadf0d]
- Updated dependencies [ae10a01]
- Updated dependencies [92876f0]
- Updated dependencies [4b70d28]
- Updated dependencies [d9d3463]
- Updated dependencies [2a40f69]
- Updated dependencies [bec3e14]
- Updated dependencies [b4d3c22]
- Updated dependencies [1f9b905]
- Updated dependencies [cb13400]
- Updated dependencies [bc64bfe]
- Updated dependencies [abb0f81]
- Updated dependencies [38ab505]
- Updated dependencies [3e19fe7]
- Updated dependencies [b953a97]
- Updated dependencies [d7f3e30]
- Updated dependencies [7e4f0e5]
- Updated dependencies [a84385b]
- Updated dependencies [45e1949]
- Updated dependencies [c1d939f]
- Updated dependencies [a3ae404]
- Updated dependencies [bfdf3d4]
- Updated dependencies [bb68488]
- Updated dependencies [b1e42d0]
- Updated dependencies [3f5f87c]
- Updated dependencies [f5e1143]
- Updated dependencies [f148a64]
- Updated dependencies [bb68488]
- Updated dependencies [47f551b]
- Updated dependencies [ab04728]
- Updated dependencies [5bf09fd]
  - @object-ui/react@17.5.0
  - @object-ui/components@17.5.0
  - @object-ui/types@17.5.0

## 17.4.0

### Patch Changes

- c32323e: Generated temp apps now declare every package they import, at ranges anchored to this repo

  `objectui dev` / `serve` / `build` write a throwaway app into `<cwd>/.objectui-tmp`,
  and the `package.json` they wrote named neither `lucide-react` nor any of the seven
  `@object-ui/plugin-*` packages the generated sources import — while pinning
  `@object-ui/react` and `@object-ui/components` at `^0.1.0`, a range that resolves to
  nothing at all for packages published at 17.x (the registry has no 0.1.0). Outside
  this workspace that manifest could not install; inside it, hoisting to the root
  `node_modules` satisfied every missing name, so nothing was ever red.

  **`lucide-react` is now declared** (objectui#3827). Both of its imports in the
  generated layout are live — `import * as LucideIcons` feeds a `DynamicIcon` lookup
  and four `LucideIcons.*` icons, and the named `{ Moon, Sun }` renders the theme
  toggle — so this is the opposite disposition from the sibling generator, where
  objectui#3755 removed an equivalent declaration precisely because nothing imported
  it. Anchored to `^1.28.0`, the range all 23 in-repo manifests that import lucide
  agree on. `commands/dev.ts` had been covering the gap in the consumer, aliasing
  `lucide-react` to a path resolved out of `packages/components` "to avoid dependency
  not found in temp app" — but only in monorepo mode, leaving every other path with an
  unsatisfiable import. The declaration belongs at the producer; the alias is now a
  workspace convenience rather than the only thing holding the import up.

  **The seven plugin packages are now declared too**, in both generators. Measuring
  the reported defect turned up that `src/App.tsx` side-effect-imports
  `@object-ui/plugin-charts`, `-editor`, `-kanban`, `-markdown`, `-form`, `-grid` and
  `-view` to register their components, and no manifest ever named them: the
  undeclared set was eight packages, not the one the issue reported.

  **`@object-ui/*` ranges are derived from this CLI's own version** instead of being
  written out as literals. `.changeset/config.json` puts `@object-ui/cli` in the same
  `fixed` group as every platform package a generated app depends on, so they always
  publish at one version — which makes `^<own version>` both current and guaranteed to
  exist on the registry. A literal here is not merely a fossil risk but a fossil
  generator: that group re-versions on every release, so any hard-coded range is stale
  the next day. This is how `^0.1.0` survived to sit 16 majors behind.

  **The toolchain ranges are anchored to in-repo manifests**, the discipline
  objectui#3742/objectui#3754 established: `vite ^5.0.0` → `^8.2.0`, `typescript
~5.7.3` → `^6.0.3`, `@vitejs/plugin-react ^4.2.1` → `^6.0.5`, `react`/`react-dom`
  `^18.3.1` → `19.2.8` with `@types/*` to match, `react-router-dom ^7.12.0` →
  `^7.18.2`, `postcss ^8.5.6` → `^8.5.26`, `autoprefixer ^10.4.23` → `^10.5.4`. React
  quotes the root's installed version rather than the wider `^18 || ^19` the platform
  packages accept as a peer: the peer says what can work, the root says what the
  generated code has actually run against, and inside this workspace the temp app
  resolves React by hoisting to the root.

  `tailwindcss` is deliberately left at `^3.4.19`. This repo is on Tailwind 4 and
  `@object-ui/components` peers `^4.2.1`, so the range is not merely behind — it
  conflicts. But re-anchoring it is not a version edit: the generated `index.css` uses
  v3 directives, the generated `postcss.config.js` names the plugin key v4 moved to
  `@tailwindcss/postcss`, and the generated `tailwind.config.js` is a v3 config. Raising
  the range without rewriting those three files yields an app that installs and renders
  unstyled, which looks fixed and is worse. Filed separately as objectui#3852; kept
  internally consistent at v3 until then, and pinned as a deliberate deferral rather
  than left to read as drift.

  The generators now build their output as a file map that the writers spill to disk,
  so tests assert over the same artifact the CLI writes. Three structural gates port
  the ones the sibling generator grew: every bare import must be declared, no versioned
  runtime dependency may be declared that nothing imports, and no generated `src/**`
  file may be unreachable from `src/main.tsx` — the one module `index.html` loads. Each
  is paired with a self-test that plants the defect back. Note for the next port: the
  `create-plugin` import scanner matches single-quoted specifiers only, and these
  templates mix quote styles, so a verbatim copy would have been blind to
  `from "lucide-react"` — one of the two lines this issue reports.

- 8277053: 修复 `objectui dev` 生成的临时 app 的 CSS 管线:整套从 Tailwind 3 迁到 Tailwind 4

  生成器写出的样式面此前是完整的 v3 三件套 —— `src/index.css` 用 `@tailwind base/components/utilities` 指令、`postcss.config.js` 写 v3 的 `tailwindcss: {}` 插件键、外加一份 `tailwind.config.js` —— 而仓内与 `@object-ui/components` 都已在 v4(components 的 peer 是 `tailwindcss ^4.2.1`)。两个后果都是真的:

  - **仓内 `objectui dev` 今天不出样式。** `commands/dev.ts` 的 monorepo 分支把 `require('tailwindcss')(configPath)` 当 PostCSS 插件调用,v4 下这条路径只会抛 "moved to `@tailwindcss/postcss`",而该异常被 `try/catch` 吞成一行黄字警告;`css.postcss` 因此没被设上,Vite 退回去搜配置文件,`/src/index.css` 请求最终 500(实测:`Failed to load PostCSS config … Cannot find module '@tailwindcss/postcss'`),浏览器里一条样式都没有。
  - **仓外一次干净安装会 ERESOLVE。** 生成清单声明 `tailwindcss ^3.4.19`,与它依赖的 `@object-ui/components` 的 v4 peer 冲突。

  改动:

  - `src/index.css` 改为仓内惯用的 v4 CSS-first 写法(`@import 'tailwindcss'` + `@custom-variant dark` + `@source` + `@theme`),`@theme` 的 token 集与 `packages/components/src/index.css` 逐条对齐 —— 包含 v3 config 一直缺、而生成的 `src/Layout.tsx` 自己就在用的 8 个 `sidebar-*` token。
  - `postcss.config.js` 改写 `'@tailwindcss/postcss': {}`;`tailwind.config.js` 不再生成(v4 下没有 `@config` 指向它时它就是死文件,仓内本身也零个 `tailwind.config.*`),v3 的 `content` 扫描面等价迁为 `@source`。
  - 清单:`tailwindcss` 抬到 `^4.3.3` 并新增 `@tailwindcss/postcss ^4.3.3`,两者都锚回仓内(#3827 记的 `TAILWIND_V3_DEFERRED` 记账钉随之翻转)。
  - `commands/dev.ts` 改用 `@tailwindcss/postcss`,并由 `@object-ui/cli` 自己声明这两个插件包;加载失败不再吞成警告,而是带修法响亮报错 —— 静默无样式正是这个缺陷能潜伏这么久的原因。

- 59df371: `objectui doctor` now diagnoses Tailwind 4 instead of Tailwind 3

  The Tailwind section of `objectui doctor` was written against v3 and got every
  question backwards on a v4 project — which is every project this repo ships.

  **It counted a missing `tailwind.config.js` as an issue.** In v4 that file is not
  part of the setup: the engine reads CSS-first configuration (`@import
'tailwindcss'`, `@theme`, `@source`) and only loads a JS config when a stylesheet
  opts in with `@config`. So the command reported a problem that did not exist and
  pushed the reader toward creating a file Tailwind would never read. Measured on
  `examples/console-starter`, a correct v4 app: before, `Found 1 issue(s)` —
  `⚠️ tailwind.config.js not found`; after, `Everything looks good! ✨`. The repo's
  own root reproduced it identically.

  **It then graded that file on its `content` array**, the v3 key `@source`
  replaced. The two `tailwind.config.*` files still tracked here are exactly that
  trap: `apps/console` and `examples/byo-backend-console` both declare a `content`
  array, no stylesheet in the repo contains `@config`, so both files are inert —
  and the old check answered `✓ Tailwind content paths configured` for them. A
  false green on a dead file. `apps/console` before: `Everything looks good! ✨`;
  after: one finding saying the config is inert and what to do about it.

  **It never checked `@tailwindcss/postcss`**, the one dependency a v4 build cannot
  start without — v4 moved the PostCSS plugin out of `tailwindcss` into that
  package, and naming the old `tailwindcss` key in a PostCSS config resolves to a
  shim whose only job is to throw. That is the failure form objectui#3852 measured
  on the generated app, and doctor printed `✓ Tailwind CSS installed` straight
  through it.

  The checks are now the v4 contract, matching what `objectui init` scaffolds:
  `@tailwindcss/postcss` declared or installed, a PostCSS config naming it rather
  than the v3 `tailwindcss` key, and a CSS entry running `@import 'tailwindcss'`
  (with `@source` acknowledged when present). The declared `tailwindcss` major is
  read too, so a v3 range is named as migration debt instead of passing as
  `✓ installed`.

  Two deliberate silences, because objectui#3891 is about doctor asserting things
  it cannot see. A **missing** `tailwind.config.*` produces no finding of any level
  — only a _present_ one does, and only when nothing opts into it via `@config`.
  And when no recognised CSS entry exists at all (a monorepo root, a bespoke
  layout), the CSS verdicts are skipped rather than guessed.

  A v3-tolerant dual path — branching on the declared major and running two sets of
  checks — was considered and deliberately not built: it widens the product surface
  past this repo's v4-only posture. v3 spellings are diagnosed as migration debt,
  not supported as a second mode.

  Internally `runDiagnostics(cwd)` now returns structured findings carrying a
  stable `id`, and `doctor()` only renders and counts them. That split is what
  makes the matrix testable against real fixture directories instead of scraped
  console output; the tests pin verdicts by `id`, so wording can improve without
  the coverage evaporating.

- 85fb95b: Fix `objectui init` scaffolding an app that renders neither components nor styles.

  The generated `src/App.tsx` imported only `SchemaRenderer` from `@object-ui/react`, which does not depend on `@object-ui/components` — and registration is a side effect of importing that package. The component registry was therefore empty in every scaffolded project, and each node of all three templates (`simple`, `form`, `dashboard`) rendered "Unknown component type". The manifest already declared `@object-ui/components`; it was declared and never imported. The generated `src/App.tsx` now performs the side-effect import.

  The generated `src/index.css` was a bare `@import 'tailwindcss';` and never loaded the library's published stylesheet, so the theme utilities the templates lean on had no tokens behind them. It now also does `@import '@object-ui/components/style.css';`, matching what the quick-start guide teaches hand-rolled consumers.

  `objectui init` is unchanged in every other respect: the same eleven files, byte for byte, apart from these two lines.

- c29ceff: Move the generator templates' dependency ranges onto the repo's current ones

  The dependabot wave of 2026-08-10 bumped `lucide-react` to `1.29.0` and `vite`
  to `8.2.1` in this repo's own manifests, but the ranges hard-coded in the
  scaffold generators do not move with it — dependabot does not know the
  templates exist. A project scaffolded by `objectui init` / `objectui dev` or by
  `create-plugin` therefore declared a range the repo itself had already moved
  past.

  Three ranges are re-anchored: `lucide-react` `^1.28.0` → `^1.29.0` in the routed
  app generator, and `vite` `^8.2.0` → `^8.2.1` in both the shared CLI scaffold
  devDependencies and the create-plugin template.

- 0a09793: `objectui init` now versions the project it scaffolds against the CLI that wrote it, and stops writing a `tailwind.config.js` Tailwind 4 never reads.

  The generated `package.json` asked for `@object-ui/components` and `@object-ui/react` at `^2.0.0` while those packages publish at 17.x, so `npm install` in a fresh scaffold resolved a major unrelated to the CLI that produced it. Both ranges are now derived from the CLI's own version, which is sound because `.changeset/config.json` releases the CLI and every platform package from one `fixed` group. The scaffold's toolchain ranges had drifted the same way — vite `^7.3.1` against the repo's `^8.2.0`, typescript `^5.9.3` against `^6.0.3`, and seven more — and now read from the same table the temp-app generators use rather than from literals of their own.

  The scaffold's CSS pipeline was already Tailwind 4 (`@tailwindcss/postcss`, `@import 'tailwindcss'`), and v4 reads a JS config only when a stylesheet points `@config` at one. The `tailwind.config.js` written beside it was therefore inert — an authoritative-looking `content` list nothing consumed — and is no longer written.

- Updated dependencies [794c497]
- Updated dependencies [993336f]
- Updated dependencies [f0a625a]
- Updated dependencies [b5980f4]
- Updated dependencies [8aad9fd]
- Updated dependencies [0cbdca8]
- Updated dependencies [d229dfa]
- Updated dependencies [ecae400]
- Updated dependencies [d3e738a]
- Updated dependencies [c3b01a7]
- Updated dependencies [7ed3360]
- Updated dependencies [0fa5e4d]
- Updated dependencies [5bfaabd]
- Updated dependencies [e06810e]
- Updated dependencies [ab3ad4f]
- Updated dependencies [c2fd122]
- Updated dependencies [e24d767]
- Updated dependencies [aca561a]
- Updated dependencies [48132f7]
- Updated dependencies [0ef9dfd]
- Updated dependencies [0109f54]
- Updated dependencies [7e5bb5d]
- Updated dependencies [e6fdbdc]
- Updated dependencies [54233b1]
- Updated dependencies [97b63d7]
- Updated dependencies [7e2b7e9]
- Updated dependencies [c1e1e6b]
  - @object-ui/components@17.4.0
  - @object-ui/react@17.4.0
  - @object-ui/types@17.4.0

## 17.3.0

### Patch Changes

- Updated dependencies [532cf8b]
- Updated dependencies [680080a]
- Updated dependencies [a7651e6]
- Updated dependencies [d915c47]
- Updated dependencies [b71fc92]
- Updated dependencies [34595eb]
- Updated dependencies [3889ffb]
- Updated dependencies [9e9e9a9]
- Updated dependencies [56409c2]
- Updated dependencies [042e09d]
- Updated dependencies [9cbcbf4]
- Updated dependencies [85c4c9c]
- Updated dependencies [fd54c3e]
- Updated dependencies [4eeb932]
- Updated dependencies [23018cc]
- Updated dependencies [53811d1]
- Updated dependencies [d915c47]
- Updated dependencies [f44d872]
- Updated dependencies [825bbe3]
- Updated dependencies [5dd0127]
- Updated dependencies [06632e9]
- Updated dependencies [a4cff5b]
- Updated dependencies [175bd79]
- Updated dependencies [f833d3a]
- Updated dependencies [71be406]
- Updated dependencies [d22ae31]
- Updated dependencies [8d8094a]
  - @object-ui/components@17.3.0
  - @object-ui/types@17.3.0
  - @object-ui/react@17.3.0

## 17.2.0

### Patch Changes

- Updated dependencies [4ae0ac4]
- Updated dependencies [696e3c1]
- Updated dependencies [a889e31]
- Updated dependencies [09d30a4]
- Updated dependencies [4bf612c]
- Updated dependencies [cb82705]
- Updated dependencies [f572849]
- Updated dependencies [f6e8d78]
- Updated dependencies [ea96284]
- Updated dependencies [a8ad6c0]
- Updated dependencies [444457c]
- Updated dependencies [022e4c3]
- Updated dependencies [009e25d]
- Updated dependencies [726b89c]
  - @object-ui/types@17.2.0
  - @object-ui/components@17.2.0
  - @object-ui/react@17.2.0

## 17.1.0

### Patch Changes

- c735bf7: fix(form): a spec-vocabulary field no longer crashes the standalone form, and every surface now says which vocabulary you meant — #3090

  Writing the regression test against the unfixed renderer proved the failure
  was worse than the assumed silent drop: a `{ field: 'x' }` entry (spec
  form-VIEW vocabulary) slipped past the `f?.name` guards into a
  react-hook-form Controller with `name === undefined` and crashed the whole
  standalone form on `name.split('.')`, with nothing naming the culprit entry.
  The renderer now partitions such entries out — the rest of the form renders —
  and surfaces them with an inline alert plus a console.error whose text is the
  fix instruction (rename to `name`, or use an object-bound form whose sections
  accept the spec shape).

  `objectui validate` grows the same boundary awareness: on failure, a
  `{ field: … }` entry in a standalone form gets a "likely cause" hint naming
  the real fix instead of the bare `invalid_union` — the previous message read
  as "bolt a `name` on", which converts spec metadata wrongly. On success,
  mixed-vocabulary entries (`name` + string `field`) get a warning: they
  validate, but the spec key is dead weight the renderer ignores.

  `normalizeSectionField` warns (once per site) when an authored section field
  mixes both identity keys — the spec branch derives the runtime name from
  `field`, so an authored `name` was silently overwritten.

- Updated dependencies [fc0272a]
- Updated dependencies [9e7349e]
- Updated dependencies [8864971]
- Updated dependencies [c785740]
- Updated dependencies [b41f401]
- Updated dependencies [19e9fa0]
- Updated dependencies [9eb932b]
- Updated dependencies [38ca8be]
- Updated dependencies [68ef584]
- Updated dependencies [4952edf]
- Updated dependencies [7f0252e]
- Updated dependencies [c769d3d]
- Updated dependencies [7639a61]
- Updated dependencies [94e63ef]
- Updated dependencies [c735bf7]
- Updated dependencies [02aef0c]
- Updated dependencies [c4db402]
- Updated dependencies [5319bf1]
- Updated dependencies [49e5671]
- Updated dependencies [9a04d25]
- Updated dependencies [b5b97e2]
- Updated dependencies [f59f2c1]
- Updated dependencies [07de839]
- Updated dependencies [2a40b5e]
- Updated dependencies [df613fa]
- Updated dependencies [4874117]
- Updated dependencies [ce08d55]
- Updated dependencies [eb4b740]
- Updated dependencies [5b084eb]
- Updated dependencies [aa1240a]
- Updated dependencies [2374a49]
- Updated dependencies [2d5d594]
- Updated dependencies [ea7f477]
- Updated dependencies [379728f]
- Updated dependencies [7f23cd0]
- Updated dependencies [0ded602]
- Updated dependencies [24e0e0a]
- Updated dependencies [3a6cf24]
- Updated dependencies [aa35561]
- Updated dependencies [03bd53b]
- Updated dependencies [3c1f321]
- Updated dependencies [a045a32]
- Updated dependencies [912496d]
- Updated dependencies [80edbd4]
- Updated dependencies [9867281]
  - @object-ui/components@17.1.0
  - @object-ui/react@17.1.0
  - @object-ui/types@17.1.0

## 17.0.0

### Patch Changes

- dc7a798: fix(plugin-grid,plugin-form,plugin-designer,cli,vscode-extension): type-check the last five unchecked packages, and fix the two runtime bugs that hid there (#2919)

  Closes the remaining `DEBT` entries from the #2911 sweep. Each package gains
  `"type-check": "tsc --noEmit"` and loses its entry in
  `scripts/check-type-check-coverage.mjs`; coverage goes 36 -> 41 of 45 and
  outstanding errors 25 -> 5 (only #2916 `plugin-view` and #2918 `layout` remain).

  **Two of these were real bugs, not just type noise.**

  `@object-ui/cli` — `objectui validate` could never report a validation failure.
  `ZodError.errors` was removed in Zod 4 (the repo is on 4.4.3), so `.errors` read
  `undefined` and `.forEach` threw a `TypeError` that the enclosing `catch`
  reported as `✗ Error reading or parsing schema file: Cannot read properties of
undefined` — swallowing the very errors the command exists to print. Now reads
  `.issues`. Verified against the built CLI: an invalid schema now prints
  `1. Invalid input / Code: invalid_union` and exits 1.

  `@object-ui/plugin-grid` — grouping a grid by a boolean column showed the raw
  i18n key. `t('grid.booleanTrue', 'Yes')` asked for a key present in neither
  `GRID_DEFAULT_TRANSLATIONS` nor any locale bundle, and passed the English
  fallback as a bare second argument — which `createSafeTranslation`'s no-provider
  translator reads as an _options object_, so the fallback never applied and the
  header rendered the literal `grid.booleanTrue`. Switched to the `grid.yes` /
  `grid.no` keys the boolean cell renderer (`ObjectGrid.tsx`) and
  `BulkActionDialog` already use, with the fallback passed as `defaultValue`.
  Covered by a new regression test, confirmed to fail against the old code.

  The rest are type-only corrections that preserve runtime behaviour exactly:

  - **plugin-grid** `importParsers.ts` — `scorePair`'s `score`/`reason` moved into
    one `best` record. They were captured `let`s mutated only inside the `bump`
    closure, which TypeScript's control-flow analysis does not track, so it still
    believed `reason` was `'none'` at the type gate and flagged the comparisons as
    non-overlapping (TS2367). The gate — which stops a text column being mapped
    onto a number field — is unchanged; its two dedicated tests still pass.
  - **plugin-form** — `SectionFieldsContext.fieldLabel` now requires `fallback`,
    matching the `useSafeFieldLabel` producer in `@object-ui/i18n` (an omitted
    fallback could not satisfy the `=> string` return, and all four call sites
    already pass one). This one signature cleared six errors.
    `MasterDetailFormSchema.recordId` widens to `string | number`, matching
    `ObjectFormSchema` and the five envelopes that forward straight into it;
    it is narrowed with `String()` only at the batch-transaction boundary, whose
    `BatchTransactionOperation.id` is a string by protocol (the `isEdit` guard
    already proves it non-null there). `deriveMasterDetail`'s column sort gets an
    explicit `fillPriority` helper — `GridColumn.type` is optional, and a column
    without one keeps sorting at priority 5 exactly as the old
    `TYPE_FILL_PRIORITY[undefined] ?? 5` lookup put it.
  - **plugin-designer** — unused `index` parameter prefixed `_`, matching the
    `_entry` beside it.
  - **cli** — a stale `@ts-expect-error` removed; `viteConfig` is typed `any`, so
    the line it guarded had stopped erroring.
  - **vscode-extension** (`object-ui`) — migrated off `moduleResolution: "node"`,
    which is deprecated and stops working in TypeScript 7, to `node16` paired with
    `module: "node16"` (the package has no `"type": "module"`, so node16 resolves
    it as the CommonJS that tsup emits, and it gains the `exports`-map awareness
    node10 lacks). Its error count was under-reported as 1: that TS5107 config
    error masked four more. The package uses `console`/`Buffer` but sets
    `lib: ["ES2020"]` with no DOM and never declared `@types/node` — added, with an
    explicit `types: ["node", "vscode"]`.

  Also: `plugin-grid`, `plugin-form` and `plugin-designer` gain the `baseUrl` +
  `paths` override their type-checked plugin peers already carry, and `cli` an
  empty `paths`. Without it the inherited root `paths` point `@object-ui/*` at
  sibling `src/`, which is outside each project's `rootDir` and produces the ~104
  spurious TS6059 errors noted in #2915; workspace deps instead resolve through
  node_modules to built `.d.ts`, which `type-check`'s `dependsOn: ["^build"]`
  guarantees exist.

  Verified the gate genuinely covers all five rather than trusting the green:
  injecting a type error into each package makes `pnpm type-check --filter <pkg>`
  fail, which was impossible before this change.

- Updated dependencies [7b21891]
- Updated dependencies [952b978]
- Updated dependencies [de5e40c]
- Updated dependencies [1767124]
- Updated dependencies [8ecf5a6]
- Updated dependencies [7b35e4b]
- Updated dependencies [8fb1295]
- Updated dependencies [dfd3705]
- Updated dependencies [c77108c]
- Updated dependencies [c19ac11]
- Updated dependencies [6dee2cb]
- Updated dependencies [c7cff19]
- Updated dependencies [cd09a7b]
- Updated dependencies [f1abf0e]
- Updated dependencies [f05b84e]
- Updated dependencies [2f947e4]
- Updated dependencies [7d46648]
- Updated dependencies [9b53d72]
- Updated dependencies [662bdf9]
- Updated dependencies [059a052]
- Updated dependencies [53642d4]
- Updated dependencies [8aae006]
- Updated dependencies [c6cfdf1]
- Updated dependencies [d147a13]
- Updated dependencies [c6aaed8]
- Updated dependencies [dc334da]
  - @object-ui/components@17.0.0
  - @object-ui/react@17.0.0
  - @object-ui/types@17.0.0

## 16.1.0

### Patch Changes

- 549c67d: chore(lint): clear the mechanical baseline lint errors so these packages' lint gates protect them again

  Extends the fields/core cleanup from #2709 (objectui#2713). These eight package
  lints were red at baseline on `main`, so their per-package `lint` gate could not
  catch new violations of the same class. Cleared every **error** (no behavior
  change; warnings are out of scope):

  - **`no-useless-catch`** (`data-objectstack`) — unwrapped five try/catch blocks
    whose `catch` only re-threw; errors still propagate identically.
  - **`preserve-caught-error`** (`cli`, `data-objectstack`, `react`) — the caught
    error's message is inlined into the thrown `Error`; a scoped disable with a
    justifying comment carries each one, because these packages target ES2020
    whose lib types the 1-arg `Error` constructor only (so `{ cause }` won't
    compile) — same reasoning as the core case in #2709.
  - **`prefer-const`** (`plugin-calendar`, `plugin-map`) — `let`→`const` for
    never-reassigned bindings.
  - **`no-empty-object-type`** (`plugin-designer`) — empty extend-only interfaces
    → equivalent `type` aliases.
  - **`no-useless-assignment`** (`react`) — dropped a dead initializer that both
    branches overwrite before it is read.
  - **`no-require-imports`** (`plugin-calendar`, `plugin-timeline` tests) —
    hoisted `vi.mock` factories now use an `async` factory with
    `await import('react')` instead of `require('react')`.
  - **stale `eslint-disable` directive** (`plugin-markdown`) — removed a
    `react/no-danger` disable whose plugin is not loaded in the flat config (an
    unknown-rule reference that ESLint v10 reports as an error); the rationale is
    kept as a plain comment.

- Updated dependencies [7cf4051]
- Updated dependencies [803558e]
- Updated dependencies [2e7d7f0]
- Updated dependencies [ef14f69]
- Updated dependencies [94d4876]
- Updated dependencies [69fa5d1]
- Updated dependencies [549c67d]
- Updated dependencies [2b17339]
- Updated dependencies [31b77d4]
- Updated dependencies [6d4fbe6]
- Updated dependencies [62b9ab5]
- Updated dependencies [1629313]
- Updated dependencies [29c6040]
- Updated dependencies [faebac3]
- Updated dependencies [199fa83]
  - @object-ui/types@16.1.0
  - @object-ui/react@16.1.0
  - @object-ui/components@16.1.0

## 16.0.0

### Patch Changes

- Updated dependencies [d3e19ed]
- Updated dependencies [59d4fa9]
- Updated dependencies [4c7c47f]
- Updated dependencies [210806a]
- Updated dependencies [b4ef588]
- Updated dependencies [5534535]
- Updated dependencies [9b8f978]
- Updated dependencies [195a651]
- Updated dependencies [33b4995]
  - @object-ui/react@16.0.0
  - @object-ui/components@16.0.0
  - @object-ui/types@16.0.0

## 15.0.0

### Patch Changes

- @object-ui/types@15.0.0
- @object-ui/react@15.0.0
- @object-ui/components@15.0.0

## 14.1.0

### Patch Changes

- Updated dependencies [2ded18c]
- Updated dependencies [e628d1f]
- Updated dependencies [5523fc4]
- Updated dependencies [887062c]
- Updated dependencies [055e1d2]
- Updated dependencies [9e2d58f]
- Updated dependencies [dea65f7]
- Updated dependencies [f30ff68]
- Updated dependencies [073e7aa]
- Updated dependencies [6c0135c]
- Updated dependencies [5b52624]
- Updated dependencies [4afb251]
- Updated dependencies [d5b1bc0]
- Updated dependencies [f94905d]
- Updated dependencies [f0f10f5]
  - @object-ui/types@14.1.0
  - @object-ui/react@14.1.0
  - @object-ui/components@14.1.0

## 14.0.0

### Patch Changes

- Updated dependencies [86c69c3]
- Updated dependencies [a44e7b6]
- Updated dependencies [6a74160]
  - @object-ui/react@14.0.0
  - @object-ui/types@14.0.0
  - @object-ui/components@14.0.0

## 13.2.0

### Patch Changes

- Updated dependencies [80901aa]
- Updated dependencies [e492b9d]
  - @object-ui/components@13.2.0
  - @object-ui/react@13.2.0
  - @object-ui/types@13.2.0

## 13.1.0

### Patch Changes

- @object-ui/types@13.1.0
- @object-ui/react@13.1.0
- @object-ui/components@13.1.0

## 13.0.0

### Patch Changes

- Updated dependencies [ac04b76]
- Updated dependencies [619097e]
  - @object-ui/components@13.0.0
  - @object-ui/types@13.0.0
  - @object-ui/react@13.0.0

## 12.1.0

### Patch Changes

- Updated dependencies [6cbccf3]
- Updated dependencies [c31874d]
  - @object-ui/components@12.1.0
  - @object-ui/types@12.1.0
  - @object-ui/react@12.1.0

## 12.0.0

### Patch Changes

- Updated dependencies [226fde9]
- Updated dependencies [e4de456]
  - @object-ui/types@12.0.0
  - @object-ui/components@12.0.0
  - @object-ui/react@12.0.0

## 11.5.0

### Patch Changes

- Updated dependencies [6fffd3d]
- Updated dependencies [9255686]
- Updated dependencies [fae75e2]
- Updated dependencies [1072701]
  - @object-ui/react@11.5.0
  - @object-ui/components@11.5.0
  - @object-ui/types@11.5.0

## 11.4.0

### Patch Changes

- Updated dependencies [8bf6295]
- Updated dependencies [1948c5b]
- Updated dependencies [bce581a]
- Updated dependencies [c38d107]
- Updated dependencies [7782698]
- Updated dependencies [e84d64d]
  - @object-ui/types@11.4.0
  - @object-ui/components@11.4.0
  - @object-ui/react@11.4.0

## 11.3.0

### Patch Changes

- Updated dependencies [d88c8ec]
- Updated dependencies [b7237bb]
- Updated dependencies [d23d6eb]
  - @object-ui/components@11.3.0
  - @object-ui/react@11.3.0
  - @object-ui/types@11.3.0

## 11.2.0

### Patch Changes

- Updated dependencies [9e7a986]
  - @object-ui/components@11.2.0
  - @object-ui/react@11.2.0
  - @object-ui/types@11.2.0

## 11.1.0

### Patch Changes

- @object-ui/components@11.1.0
- @object-ui/react@11.1.0
- @object-ui/types@11.1.0

## 7.3.0

### Patch Changes

- @object-ui/types@7.3.0
- @object-ui/react@7.3.0
- @object-ui/components@7.3.0

## 7.2.0

### Patch Changes

- Updated dependencies [d23db5c]
  - @object-ui/types@7.2.0
  - @object-ui/components@7.2.0
  - @object-ui/react@7.2.0

## 7.1.0

### Patch Changes

- Updated dependencies [677f7ed]
- Updated dependencies [a71be60]
- Updated dependencies [cb03bc3]
  - @object-ui/types@7.1.0
  - @object-ui/react@7.1.0
  - @object-ui/components@7.1.0

## 7.0.0

### Patch Changes

- Updated dependencies [a00e16d]
- Updated dependencies [c12986e]
- Updated dependencies [ddbe4a2]
- Updated dependencies [2d47e94]
- Updated dependencies [9049bbe]
- Updated dependencies [6c0c92c]
- Updated dependencies [cb2fdb1]
- Updated dependencies [6cfa330]
- Updated dependencies [ad8ade6]
- Updated dependencies [3870c20]
- Updated dependencies [2eb3096]
- Updated dependencies [b88c560]
- Updated dependencies [d16566f]
- Updated dependencies [90acb7f]
- Updated dependencies [7913390]
- Updated dependencies [e95cc25]
- Updated dependencies [abe8ebc]
- Updated dependencies [300d755]
- Updated dependencies [bd8b054]
- Updated dependencies [4eb9cb6]
- Updated dependencies [858ad94]
- Updated dependencies [2270239]
- Updated dependencies [8d1195d]
  - @object-ui/components@7.0.0
  - @object-ui/react@7.0.0
  - @object-ui/types@7.0.0

## 6.2.3

### Patch Changes

- @object-ui/types@6.2.3
- @object-ui/react@6.2.3
- @object-ui/components@6.2.3

## 6.2.2

### Patch Changes

- Updated dependencies [a66f788]
  - @object-ui/react@6.2.2
  - @object-ui/components@6.2.2
  - @object-ui/types@6.2.2

## 6.2.1

### Patch Changes

- @object-ui/types@6.2.1
- @object-ui/react@6.2.1
- @object-ui/components@6.2.1

## 6.2.0

### Patch Changes

- @object-ui/react@6.2.0
- @object-ui/components@6.2.0
- @object-ui/types@6.2.0

## 6.1.0

### Patch Changes

- Updated dependencies [991b62d]
  - @object-ui/types@6.1.0
  - @object-ui/components@6.1.0
  - @object-ui/react@6.1.0

## 6.0.4

### Patch Changes

- @object-ui/types@6.0.4
- @object-ui/react@6.0.4
- @object-ui/components@6.0.4

## 6.0.3

### Patch Changes

- @object-ui/types@6.0.3
- @object-ui/react@6.0.3
- @object-ui/components@6.0.3

## 6.0.2

### Patch Changes

- @object-ui/types@6.0.2
- @object-ui/react@6.0.2
- @object-ui/components@6.0.2

## 6.0.1

### Patch Changes

- @object-ui/types@6.0.1
- @object-ui/react@6.0.1
- @object-ui/components@6.0.1

## 6.0.0

### Patch Changes

- @object-ui/types@6.0.0
- @object-ui/react@6.0.0
- @object-ui/components@6.0.0

## 5.4.2

### Patch Changes

- @object-ui/types@5.4.2
- @object-ui/react@5.4.2
- @object-ui/components@5.4.2

## 5.4.1

### Patch Changes

- @object-ui/types@5.4.1
- @object-ui/react@5.4.1
- @object-ui/components@5.4.1

## 5.4.0

### Patch Changes

- Updated dependencies [3a8c754]
  - @object-ui/types@5.4.0
  - @object-ui/components@5.4.0
  - @object-ui/react@5.4.0

## 5.3.2

### Patch Changes

- @object-ui/types@5.3.2
- @object-ui/react@5.3.2
- @object-ui/components@5.3.2

## 5.3.1

### Patch Changes

- @object-ui/types@5.3.1
- @object-ui/react@5.3.1
- @object-ui/components@5.3.1

## 5.3.0

### Patch Changes

- @object-ui/types@5.3.0
- @object-ui/react@5.3.0
- @object-ui/components@5.3.0

## 5.2.1

### Patch Changes

- @object-ui/types@5.2.1
- @object-ui/react@5.2.1
- @object-ui/components@5.2.1

## 5.2.0

### Patch Changes

- Updated dependencies [de0c5e6]
- Updated dependencies [9997cae]
- Updated dependencies [b2d1704]
- Updated dependencies [87bc8ff]
- Updated dependencies [3ebba63]
- Updated dependencies [a8d12ec]
- Updated dependencies [70b5570]
- Updated dependencies [aa063db]
- Updated dependencies [7c7400a]
  - @object-ui/types@5.2.0
  - @object-ui/react@5.2.0
  - @object-ui/components@5.2.0

## 5.1.1

### Patch Changes

- Updated dependencies [8955b9c]
  - @object-ui/components@5.1.1
  - @object-ui/types@5.1.1
  - @object-ui/react@5.1.1

## 5.1.0

### Patch Changes

- Updated dependencies [bd8447d]
- Updated dependencies [fbd5052]
- Updated dependencies [d51a577]
- Updated dependencies [d1ec6a2]
- Updated dependencies [cf30cc2]
- Updated dependencies [5b80cfd]
- Updated dependencies [d548d6b]
  - @object-ui/components@5.1.0
  - @object-ui/react@5.1.0
  - @object-ui/types@5.1.0

## 5.0.2

### Patch Changes

- @object-ui/components@5.0.2
- @object-ui/react@5.0.2
- @object-ui/types@5.0.2

## 5.0.1

### Patch Changes

- @object-ui/types@5.0.1
- @object-ui/react@5.0.1
- @object-ui/components@5.0.1

## 5.0.0

### Patch Changes

- Updated dependencies [8930b15]
- Updated dependencies [95b6b21]
- Updated dependencies [ddb08a7]
- Updated dependencies [765d50f]
- Updated dependencies [927187a]
- Updated dependencies [bae8ba8]
- Updated dependencies [8435860]
- Updated dependencies [bb2ea48]
- Updated dependencies [b14fe09]
- Updated dependencies [a7bef6e]
- Updated dependencies [74962b0]
- Updated dependencies [3154334]
- Updated dependencies [fa4c2cb]
- Updated dependencies [7213027]
  - @object-ui/components@5.0.0
  - @object-ui/react@5.0.0
  - @object-ui/types@5.0.0

## 4.8.0

### Patch Changes

- @object-ui/types@4.8.0
- @object-ui/react@4.8.0
- @object-ui/components@4.8.0

## 4.7.0

### Patch Changes

- @object-ui/types@4.7.0
- @object-ui/react@4.7.0
- @object-ui/components@4.7.0

## 4.6.0

### Patch Changes

- Updated dependencies [3ee436d]
  - @object-ui/components@4.6.0
  - @object-ui/types@4.6.0
  - @object-ui/react@4.6.0

## 4.5.0

### Patch Changes

- Updated dependencies [ab5e281]
- Updated dependencies [6b6afd1]
- Updated dependencies [aa7855f]
- Updated dependencies [170d89f]
  - @object-ui/types@4.5.0
  - @object-ui/components@4.5.0
  - @object-ui/react@4.5.0

## 4.4.0

### Patch Changes

- Updated dependencies [2bd45af]
  - @object-ui/components@4.4.0
  - @object-ui/types@4.4.0
  - @object-ui/react@4.4.0

## 4.3.1

### Patch Changes

- Updated dependencies [6b683c8]
  - @object-ui/components@4.3.1
  - @object-ui/react@4.3.1
  - @object-ui/types@4.3.1

## 4.3.0

### Patch Changes

- Updated dependencies [4e7bc1b]
- Updated dependencies [8442c05]
  - @object-ui/components@4.3.0
  - @object-ui/react@4.3.0
  - @object-ui/types@4.3.0

## 4.2.1

### Patch Changes

- @object-ui/types@4.2.1
- @object-ui/react@4.2.1
- @object-ui/components@4.2.1

## 4.2.0

### Patch Changes

- @object-ui/components@4.2.0
- @object-ui/react@4.2.0
- @object-ui/types@4.2.0

## 4.1.0

### Patch Changes

- @object-ui/types@4.1.0
- @object-ui/react@4.1.0
- @object-ui/components@4.1.0

## 4.0.12

### Patch Changes

- @object-ui/types@4.0.12
- @object-ui/react@4.0.12
- @object-ui/components@4.0.12

## 4.0.11

### Patch Changes

- @object-ui/components@4.0.11
- @object-ui/react@4.0.11
- @object-ui/types@4.0.11

## 4.0.10

### Patch Changes

- @object-ui/types@4.0.10
- @object-ui/react@4.0.10
- @object-ui/components@4.0.10

## 4.0.9

### Patch Changes

- @object-ui/types@4.0.9
- @object-ui/react@4.0.9
- @object-ui/components@4.0.9

## 4.0.8

### Patch Changes

- @object-ui/components@4.0.8
- @object-ui/react@4.0.8
- @object-ui/types@4.0.8

## 4.0.7

### Patch Changes

- fd15918: Comprehensive i18n refactor + CI test fix.

  **i18n (`@object-ui/i18n`)**

  - Added ~130 new keys under 12 new top-level namespaces: `layout`, `search`,
    `empty`, `renderer`, `actionDialog`, `rowAction`, `navigationSync`,
    `objectActions`, `objectViewActions`, `dashboardActions`, `recordDetail`,
    `cellRender`, plus `grid.{empty,yes,no,systemFields,openMenu}`.
  - Mirrored all new top-level namespaces to all 10 built-in locales
    (en, zh, ja, ko, de, fr, es, pt, ru, ar) to maintain key parity required
    by the locale-structure test. Non-en/zh locales seed with English values
    and rely on `fallbackLng: 'en'` until human translation lands.

  **App shell (`@object-ui/app-shell`)** — replaced hardcoded English in 14
  files with `useObjectTranslation`:

  - Layout: `AppSidebar`, `ActivityFeed` (locale-aware relative time),
    `MetadataInspector`.
  - Views: `SearchResultsPage`, `ActionParamDialog`, `RecordFormPage`,
    `RecordDetailView`, `PageView`, `DashboardView` (PDF / forecast toasts),
    `ReportView`, `ObjectView` (rename / delete view toasts).
  - Console: `AppContent` (no-apps empty state).
  - Components: `PageRenderer`, `FormRenderer`, `DashboardRenderer`.
  - Hooks: `useNavigationSync` (16 toasts incl. Undo label),
    `useObjectActions` (delete confirm + success / failure toasts).

  **Plugin grid (`@object-ui/plugin-grid`)**

  - `ObjectGrid` record-detail panel now translates Empty / Yes / No / System
    via the existing `useGridTranslation` safe-fallback wrapper.
  - `RowActionMenu` adopts a local safe-fallback i18n wrapper for
    `Open menu` / `Edit` / `Delete`, preserving standalone-usage guarantees.

  **CLI test fix (`@object-ui/cli`)**

  - `cli-bin.test.ts` auto-builds the package on first run when `dist/cli.js`
    is missing, instead of throwing. This unbreaks `pnpm test:coverage` in CI
    (root vitest run does not honor turbo's `^build` deps) and removes the
    manual `pnpm --filter @object-ui/cli build` requirement for local dev.

- Updated dependencies [7c9b85c]
  - @object-ui/react@4.0.7
  - @object-ui/components@4.0.7
  - @object-ui/types@4.0.7

## 4.0.6

### Patch Changes

- 925051d: fix: convert Tailwind v3 `[--var]` arbitrary value syntax to v4 `(--var)`

  Shadcn `Sidebar`, `Calendar`, `Chart`, `Popover`, `Tooltip`, `HoverCard`,
  `Menubar`, `Select`, `Dropdown`, `Context-Menu`, and `AppSidebar` used the
  Tailwind v3 syntax `w-[--sidebar-width]`, `origin-[--radix-...]`, etc.
  Tailwind v4 no longer interprets the bare `--xxx` inside arbitrary values
  as `var(--xxx)`, so the rule emits empty CSS — the sidebar collapses to
  0 width and overlays the main content, dropdown/popover positions fall
  back to the wrong origin, and the calendar cells lose their fixed size.

  Replaced all such occurrences with the v4 CSS-variable shorthand
  `w-(--sidebar-width)`, `origin-(--radix-...)`, etc. Existing
  `[calc(var(--xxx)*-1)]` arbitrary expressions are unaffected.

- Updated dependencies [925051d]
- Updated dependencies [1b6dc64]
  - @object-ui/components@4.0.6
  - @object-ui/types@4.0.6
  - @object-ui/react@4.0.6

## 4.0.5

### Patch Changes

- Updated dependencies [1dc6061]
  - @object-ui/components@4.0.5
  - @object-ui/types@4.0.5
  - @object-ui/react@4.0.5

## 4.0.4

### Patch Changes

- Updated dependencies [d2b6ece]
  - @object-ui/components@4.0.4
  - @object-ui/types@4.0.4
  - @object-ui/react@4.0.4

## 4.0.3

### Patch Changes

- 4be43e2: **Page-mode record forms (`editMode: 'page'`).** New per-object metadata flag that opts a record's create/edit form into a dedicated full-screen route (`/apps/:appName/:objectName/new`, `/apps/:appName/:objectName/record/:recordId/edit`). Two new declarative actions `navigate_create` and `navigate_edit` open these routes from JSON action buttons. Default modal behavior is preserved for objects that do not set `editMode`.

  **`@object-ui/plugin-list` & `@object-ui/plugin-detail`: `ComponentRegistry` singleton fix.** Both plugins' Vite configs now mark all `@object-ui/*` packages as external so each plugin no longer bundles its own private copy of `@object-ui/core`. Cross-plugin component lookups now resolve correctly from the same singleton registry. `plugin-list` dist shrank from multi-MB to 67 kB (gzip 16 kB); `plugin-detail` to 124 kB (gzip 28 kB).

  **`@object-ui/app-shell` `CreateViewDialog` churn fix.** `existingSet` is now memoised on the joined string key of `existingLabels` rather than the raw array reference, preventing the name-suggest `useEffect` from re-firing on every parent render.

  **CI fixes.** `ReportViewer` conditional-formatting test now accepts both `rgb(...)` and hex color representations. `ObjectView` i18n mocks rewritten to mirror the real hook shapes (`useObjectTranslation`, `useObjectLabel`).

- Updated dependencies [4be43e2]
  - @object-ui/types@4.0.3
  - @object-ui/react@4.0.3
  - @object-ui/components@4.0.3

## 4.0.1

### Patch Changes

- @object-ui/types@4.0.1
- @object-ui/react@4.0.1
- @object-ui/components@4.0.1

## 4.0.0

### Patch Changes

- Updated dependencies
  - @object-ui/types@4.0.0
  - @object-ui/components@4.0.0
  - @object-ui/react@4.0.0

## 3.4.0

### Patch Changes

- Updated dependencies [a2d7023]
- Updated dependencies [f1ca238]
- Updated dependencies [de881ef]
  - @object-ui/components@3.4.0
  - @object-ui/types@3.4.0
  - @object-ui/react@3.4.0

## 3.3.2

### Patch Changes

- @object-ui/types@3.3.2
- @object-ui/react@3.3.2
- @object-ui/components@3.3.2

## 3.3.1

### Patch Changes

- Updated dependencies [b429568]
  - @object-ui/components@3.3.1
  - @object-ui/types@3.3.1
  - @object-ui/react@3.3.1

## 3.3.0

### Patch Changes

- @object-ui/types@3.3.0
- @object-ui/react@3.3.0
- @object-ui/components@3.3.0

## 3.2.0

### Patch Changes

- @object-ui/types@3.2.0
- @object-ui/react@3.2.0
- @object-ui/components@3.2.0

## 3.1.5

### Patch Changes

- @object-ui/react@3.1.5
- @object-ui/components@3.1.5
- @object-ui/types@3.1.5

## 3.1.4

### Patch Changes

- @object-ui/types@3.1.4
- @object-ui/react@3.1.4
- @object-ui/components@3.1.4

## 3.1.3

### Patch Changes

- @object-ui/types@3.1.3
- @object-ui/react@3.1.3
- @object-ui/components@3.1.3

## 3.1.2

### Patch Changes

- @object-ui/types@3.1.2
- @object-ui/react@3.1.2
- @object-ui/components@3.1.2

## 3.1.1

### Patch Changes

- Updated dependencies
  - @object-ui/types@3.1.1
  - @object-ui/components@3.1.1
  - @object-ui/react@3.1.1

## 3.0.3

### Patch Changes

- @object-ui/types@3.0.3
- @object-ui/react@3.0.3
- @object-ui/components@3.0.3

## 3.0.2

### Patch Changes

- @object-ui/types@3.0.2
- @object-ui/react@3.0.2
- @object-ui/components@3.0.2

## 3.0.1

### Patch Changes

- Updated dependencies [adf2cc0]
  - @object-ui/react@3.0.1
  - @object-ui/components@3.0.1
  - @object-ui/types@3.0.1

## 3.0.0

### Minor Changes

- 87979c3: Upgrade to @objectstack v3.0.0 and console bundle optimization
  - Upgraded all @objectstack/\* packages from ^2.0.7 to ^3.0.0
  - Breaking change migrations: Hub → Cloud namespace, definePlugin removed, PaginatedResult.value → .records, PaginatedResult.count → .total, client.meta.getObject() → client.meta.getItem()
  - Console bundle optimization: split monolithic 3.7 MB chunk into 17 granular cacheable chunks (95% main entry reduction)
  - Added gzip + brotli pre-compression via vite-plugin-compression2
  - Lazy MSW loading for build:server (~150 KB gzip saved)
  - Added bundle analysis with rollup-plugin-visualizer

### Patch Changes

- Updated dependencies [87979c3]
  - @object-ui/types@3.0.0
  - @object-ui/react@3.0.0
  - @object-ui/components@3.0.0

## 2.0.0

### Major Changes

- b859617: Release v1.0.0 — unify all package versions to 1.0.0

### Patch Changes

- Updated dependencies [b859617]
  - @object-ui/types@2.0.0
  - @object-ui/react@2.0.0
  - @object-ui/components@2.0.0

## 0.3.1

### Patch Changes

- Maintenance release - Documentation and build improvements
- Updated dependencies
  - @object-ui/react@0.3.1
  - @object-ui/components@0.3.1

## 0.3.0

### Minor Changes

- Unified version across all packages to 0.3.0 for consistent versioning

## 0.2.2

### Patch Changes

- New plugin-object and ObjectQL SDK updates

  **Added:**

  - New Plugin: @object-ui/plugin-object - ObjectQL plugin for automatic table and form generation
    - ObjectTable: Auto-generates tables from ObjectQL object schemas
    - ObjectForm: Auto-generates forms from ObjectQL object schemas with create/edit/view modes
    - Full TypeScript support with comprehensive type definitions
  - Type Definitions: Added ObjectTableSchema and ObjectFormSchema to @object-ui/types
  - ObjectQL Integration: Enhanced ObjectQLDataSource with getObjectSchema() method using MetadataApiClient

  **Changed:**

  - Updated @objectql/sdk from ^1.8.3 to ^1.9.1
  - Updated @objectql/types from ^1.8.3 to ^1.9.1

- Updated dependencies
  - @object-ui/react@0.2.2
  - @object-ui/components@0.2.2

## 0.2.1

### Patch Changes

- Patch release: Add automated changeset workflow and CI/CD improvements

  This release includes infrastructure improvements:

  - Added changeset-based version management
  - Enhanced CI/CD workflows with GitHub Actions
  - Improved documentation for contributing and releasing

- Updated dependencies
  - @object-ui/react@0.2.1
  - @object-ui/components@0.2.1
