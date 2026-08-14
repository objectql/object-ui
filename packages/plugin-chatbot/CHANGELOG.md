# @object-ui/plugin-chatbot

## 17.5.0

### Minor Changes

- 3256b14: `@object-ui/plugin-chatbot`'s `ChatMessage` is now one type instead of two

  The barrel exported two different `ChatMessage` types: a minimal one it declared itself (`id` / `role` / `content` / `timestamp` / `avatar` / `avatarFallback`) and the shape `<ChatbotEnhanced>` actually renders, re-exported under the alias `ChatbotEnhancedMessage`. The natural name resolved to the narrow one, so an importer reaching for `ChatMessage` silently got the wrong contract — and the compiler could not object, because both shapes existed on purpose and every construction site spreads the extra keys conditionally, which defeats excess-property checking. That is how app-shell's `AiChatPage` ended up unable to read `toolInvocations` off its own function's return value (objectui#4040; re-pointed in PR #4379, but the collision itself was left standing). objectui#4383.

  **Breaking semantics** (declared `minor` per AGENTS.md §版本号策略 — objectui never declares `major` outside an `@objectstack` major sync): `ChatMessage` exported from `@object-ui/plugin-chatbot` now denotes the enhanced shape. In practice this is a widening rather than a removal — every field of the retired shape survives with the same type, and the enhanced shape adds only optional keys (`streaming`, `toolInvocations`, `reasoning`, `sources`, `traceId`, `buildProgress`, `blueprintProgress`, `charts`), so anything that was a valid `ChatMessage` still is, and `<Chatbot messages={…} />` keeps accepting the same values. Code that relied on the name meaning _exactly_ the six-key shape (exhaustive `keyof` maps, `Equal`-style assertions) is the case that changes.

  `ChatbotEnhancedMessage` is kept as a `@deprecated` alias of the same type, so importers that spelled the disambiguating name keep compiling; new code should import `ChatMessage`. Pinned at compile time by `packages/plugin-chatbot/src/__tests__/chat-message-contract.test.ts`.

- eec2e4f: `useObjectChat` declares the message shape it actually hands back

  The hook typed `messages` — and the `onSend(content, messages)` callback fed from it — as `@object-ui/types`' authoring `ChatMessage`. That was true in local mode only. In API mode the values came out of the runtime mapper and were asserted into place with `as OuiChatMessage[]`, and the authoring contract declares none of what they carry: `buildProgress`, `blueprintProgress`, `charts`, and `pendingActionId` / `draftReview` / `proposedPlan` / `proposedChanges` / `builderHandoff` on every tool invocation. Those keys are the HITL approval card, the "Review N changes" affordance, the proposed-plan card, the build panel and the inline charts. They survived only because nothing on the path ever rebuilt a message; anyone writing the obvious thing — reconstruct a message field-by-field from its declared type — deleted all of them, with the compiler agreeing, because the declared type genuinely did not have them.

  The declaration is now the truth, published as `ObjectChatMessage`. The survey behind it found the honest type to be neither of the two `ChatMessage` types on either side, because neither is true of both modes: it stays **wide** where local mode is wide (an authored `'tool'` role and the legacy `'partial-call'` / `'call'` / `'result'` tool states reach this surface unchanged and are folded only at the render seam), **narrow** where both modes are narrow (`timestamp` is `string`, never `Date` — API mode never produces one and local mode absorbs it before emitting), and adds the render-only keys API mode really carries. The `as OuiChatMessage[]` assertion is deleted rather than moved: the mapper's output satisfies the declared type, so the compiler checks that assignment instead of being told to stop looking.

  Nothing about the values changed, and nothing correct breaks. `ObjectChatMessage` is a **subtype** of the authoring `ChatMessage` it replaces, so every consumer that accepted the old declaration still accepts these values — including a host `onSend` callback that types its parameter as `ChatMessage[]`, which keeps type-checking by contravariance. Naming `ObjectChatMessage` is what lets a host _read_ the keys above. The one observable narrowing is deliberate: code that branched on `timestamp instanceof Date` was handling a value this hook cannot emit, and now says so at compile time.

  The seam below it (`chatMessageAdapter.ts`, from objectui#4399) is still necessary and unchanged in behaviour — `'tool'` and the legacy tool states still have to be narrowed for the renderers. What changed is that its pass-through is no longer an act of faith: its input type (`SeamChatMessage`, also exported, alongside `SeamToolInvocation`) names the render-only keys, so the spread preserves them as declared properties the compiler can see, and the pass-through tests type their API-mode fixture directly instead of casting it past the compiler. A cast returning to the hook is now caught by a test rather than by a future outage.

  App-shell carries a comment-only correction on the same family: `AiChatPage` still described `@object-ui/plugin-chatbot` as exporting a second, minimal legacy `ChatMessage` alongside the enhanced one. That collision was retired in objectui#4383 — the barrel publishes one contract and `ChatbotEnhancedMessage` is a deprecated alias of it — so the paragraph was sending readers to look for a hazard that no longer exists.

### Patch Changes

- dde7283: `chatbot` and `chatbot-enhanced` now pass only whitelisted DOM props to their host element (objectui#4431)

  Both registrations destructured `schema` and `className` and forwarded everything else. `SchemaRenderer` hands a registered component the authored node's own keys, the contents of its `props` container, the ARIA it resolved and the host's trailing props — so all of it became attributes on the chat root `div`, because React passes unknown lowercase attributes through in silence and stringifies object values. Measured through the real SDUI path with a data-source adapter attached: **14 non-DOM attributes on each widget**, including `datasource="[object Object]"` (the injected adapter, which only appears on a deployment that really loads data) and a camelCase `arialabel` sitting next to the resolved `aria-label`, so the element carried each ARIA value twice under two spellings — one of them meaningless to assistive technology.

  Both are now consume-or-whitelist: configuration is read off `schema` as before, the evaluated `disabled` verdict is consumed by name, and only `toDomProps`' output reaches the element. The resolved `aria-label` / `aria-describedby`, `role`, `id`, `tabIndex` and the `data-*` family still arrive — dropping them would have been an accessibility regression dressed as a leak fix, so the pin asserts the delivered set exactly, not just the absent one. `chatbot-floating` is untouched: its content mounts through a portal and its root never spread.

  `@object-ui/core` gains the shared executor this migration needs (`utils/dom-props.ts`): `toDomProps` for the SDUI widget contract, plus `pickDomProps` — the mechanism — for a package whose own contract declares a different key set. That is the objectui#4409 dependency direction: plugin packages declare `@object-ui/core` and must not grow a dependency on `@object-ui/fields` to reach a whitelist.

  `@object-ui/fields` keeps its own key list and its compile-time bindings, and now executes them through core's mechanism. Its behaviour is unchanged and its exported `DomProps<P>` is the same structural type. The two lists differ for measured reasons and no longer can drift silently: `name` and `disabled` are legal only on form controls, which is what every field widget renders and what `FieldWidgetComponentProps` declares, while `role` is resolved by `SchemaRenderer` for every SDUI node and is not part of the field contract. A new assertion binds every shared key in both directions, with `role` named as the single deliberate exception.

- 37bbc42: Replace the three `messages as any` casts at the `@object-ui/types` ↔
  `@object-ui/plugin-chatbot` `ChatMessage` boundary with one explicit typed
  adapter (`toRuntimeMessages` / `authoredToRuntimeMessage`, now exported).

  The authoring contract (`ChatbotSchema['messages']`) and the runtime contract
  `<ChatbotEnhanced>` renders are both deliberate and deliberately different; the
  casts erased ALL of that drift rather than the intentional parts, so a future
  vocabulary move would have surfaced as rendering behaviour instead of a type
  error. Each narrowing is now named, documented and tested: an authored
  `role: 'tool'` message is an assistant message (unchanged rendering — the
  implicit fallthrough is now the recorded decision), a `Date` timestamp becomes
  its ISO string (one expression, consumed by both the seam and the hook's
  `normalizeMessages`), and the legacy tool-invocation states
  `'partial-call'`/`'call'`/`'result'` map to their AI SDK v6 equivalents as the
  authoring type's own documentation declares — previously they reached the tool
  chip unrecognised and rendered a status badge with no label.

- Updated dependencies [0e67b53]
- Updated dependencies [ceccdcf]
- Updated dependencies [d6e5124]
- Updated dependencies [debad27]
- Updated dependencies [dc2aa3e]
- Updated dependencies [ee66e2e]
- Updated dependencies [ee26e65]
- Updated dependencies [5900ac5]
- Updated dependencies [932cbcd]
- Updated dependencies [734d186]
- Updated dependencies [f650253]
- Updated dependencies [3d9769a]
- Updated dependencies [8f85f8b]
- Updated dependencies [d0c3b26]
- Updated dependencies [3fc2971]
- Updated dependencies [aca27fa]
- Updated dependencies [dde7283]
- Updated dependencies [f7c6430]
- Updated dependencies [4dadf0d]
- Updated dependencies [ae10a01]
- Updated dependencies [92876f0]
- Updated dependencies [f279deb]
- Updated dependencies [4b70d28]
- Updated dependencies [eb7f586]
- Updated dependencies [e901131]
- Updated dependencies [d9d3463]
- Updated dependencies [2a40f69]
- Updated dependencies [bec3e14]
- Updated dependencies [613b167]
- Updated dependencies [b4d3c22]
- Updated dependencies [1f9b905]
- Updated dependencies [cb13400]
- Updated dependencies [828549a]
- Updated dependencies [e1ade8f]
- Updated dependencies [bc64bfe]
- Updated dependencies [abb0f81]
- Updated dependencies [38ab505]
- Updated dependencies [3e19fe7]
- Updated dependencies [bb58d1d]
- Updated dependencies [5cc847c]
- Updated dependencies [fa21254]
- Updated dependencies [33c32bf]
- Updated dependencies [66fb4fa]
- Updated dependencies [b953a97]
- Updated dependencies [d7f3e30]
- Updated dependencies [6d641c9]
- Updated dependencies [7e4f0e5]
- Updated dependencies [a84385b]
- Updated dependencies [45e1949]
- Updated dependencies [92250d6]
- Updated dependencies [c1d939f]
- Updated dependencies [58bebf6]
- Updated dependencies [405e808]
- Updated dependencies [49ae9f4]
- Updated dependencies [a3ae404]
- Updated dependencies [bfdf3d4]
- Updated dependencies [bb68488]
- Updated dependencies [c0f9a4b]
- Updated dependencies [b1e42d0]
- Updated dependencies [2459a3e]
- Updated dependencies [ac853ce]
- Updated dependencies [fa51109]
- Updated dependencies [d6aa172]
- Updated dependencies [fe52a04]
- Updated dependencies [d46f9b8]
- Updated dependencies [3f5f87c]
- Updated dependencies [2fea4d2]
- Updated dependencies [f5e1143]
- Updated dependencies [7f1cb33]
- Updated dependencies [f148a64]
- Updated dependencies [bb68488]
- Updated dependencies [2e3b0c0]
- Updated dependencies [9461dd3]
- Updated dependencies [78fa331]
- Updated dependencies [47f551b]
- Updated dependencies [31ab1ac]
- Updated dependencies [0082db8]
- Updated dependencies [ab04728]
- Updated dependencies [5bf09fd]
- Updated dependencies [06915b0]
- Updated dependencies [ff84b05]
  - @object-ui/i18n@17.5.0
  - @object-ui/react@17.5.0
  - @object-ui/components@17.5.0
  - @object-ui/core@17.5.0
  - @object-ui/types@17.5.0

## 17.4.0

### Minor Changes

- d9ce385: `ApproveOutcome` / `RejectOutcome` are now derived from `@objectstack/spec`
  instead of hand-transcribed (objectui#3783). Same failure class #3220 cleared
  from the same file for `PendingActionRow` / `PendingActionStatus` — but this pair
  wore local names rather than spec names, so `check-spec-symbol-derivation.mjs`,
  which fires on a spec export name being occupied, had no handle on it. A renamed
  hand copy is invisible to a name-based guard by construction.

  Both types now re-export the spec's decision responses
  (`ApproveAiPendingActionResponse` / `RejectAiPendingActionResponse` from
  `@objectstack/spec/api` — the same schemas `@objectstack/client`'s
  `ai.pendingActions.approve()` / `.reject()` type their returns with). The public
  export names do not change. The shapes do, in three ways:

  - **`ApproveOutcome` no longer declares `id`.** The approve response has never
    carried one — `id` is on the _reject_ response. This was the one drift that
    was not dormant: `useHitlInChat`'s public `onDecided` callback promised
    consumers `id: string` and handed them `undefined` at runtime, with nothing
    in the compiler to say so. **If you read `outcome.id` after an approve, that
    read was already `undefined` and now fails to compile** — take the id from
    `ContinueContext.pendingActionId` or from the row you decided on.
  - **`status` is closed.** `'executed' | 'failed' | string` and
    `'rejected' | string` were both just `string`: a union with `string` absorbs
    the literals, so neither annotation carried any information. They are now
    `'executed' | 'failed'` and `'rejected'`.
  - **The `[k: string]: unknown` index signature on `ApproveOutcome` is gone.** The
    objectstack#4075 mechanism: with it, any structural comparison against the
    spec answers "identical" however far the copy has drifted, so a parity test
    bolted onto the old type would have been green from its first day.

  **Breaking at the type level for importers of `@object-ui/plugin-chatbot`** —
  narrowing a published type is a break even when the old type was lying, which is
  why it is spelled out here. Shipped as `minor` per AGENTS.md §版本号策略: the
  family's `major` tracks `@objectstack`'s, and objectui's own breaking changes go
  out as `minor` with the break named in the changeset.

  Runtime behaviour is unchanged — including the hook's decision handling for a
  status outside the spec vocabulary, and the locally synthesized failure envelope
  on a non-2xx, both now pinned by tests. The consumer-side tolerances that remain
  in `useHitlInChat` are recorded in objectui#3790 for a maintainer decision.

### Patch Changes

- 2a54e86: `parseAiQuotaError` now reads the AI quota refusal code from all three shapes the
  cloud 429 producers use, instead of only the flat `error`-holds-the-code dialect.

  The two live producers fill the same `error` key in opposite ways — the token
  guardrail puts the **code** there, `service-ai` puts the **message** there and the
  code in a `code` sibling — while ADR-0112 declares a third shape both are
  converging on: `{ success: false, error: { code, message } }`. The consumer had to
  learn the declared shape **first**, or the producers' convergence would silently
  turn every quota refusal back into a generic "Response failed" banner (the same
  consumer-first sequencing as objectui#2992).

  - Code lookup order is a total order — declared envelope, then the flat guardrail
    code, then the `code` sibling — so a transitional producer that double-emits the
    new envelope alongside the legacy top-level keys has one defined outcome.
  - Only the code's **location** widens. The recognized code set is unchanged, and
    any unrecognized shape still degrades to today's behavior (`null`), so no
    non-quota error is newly captured by the quota CTA.
  - Companion fields (`upgrade`, `topUp`, `messageEn`) keep their established
    top-level read; their position inside the declared envelope is deliberately not
    presumed, and is aligned once the producer PR fixes the real shape.

- Updated dependencies [794c497]
- Updated dependencies [993336f]
- Updated dependencies [f0a625a]
- Updated dependencies [b5980f4]
- Updated dependencies [8aad9fd]
- Updated dependencies [6719877]
- Updated dependencies [56ff091]
- Updated dependencies [7864f03]
- Updated dependencies [0cbdca8]
- Updated dependencies [d229dfa]
- Updated dependencies [ecae400]
- Updated dependencies [4bc6c23]
- Updated dependencies [d3e738a]
- Updated dependencies [c3b01a7]
- Updated dependencies [f5f8744]
- Updated dependencies [7ed3360]
- Updated dependencies [69becd2]
- Updated dependencies [5e52495]
- Updated dependencies [0fa5e4d]
- Updated dependencies [b750823]
- Updated dependencies [5bfaabd]
- Updated dependencies [e06810e]
- Updated dependencies [ab3ad4f]
- Updated dependencies [c2fd122]
- Updated dependencies [ac2139c]
- Updated dependencies [b14ab3a]
- Updated dependencies [e24d767]
- Updated dependencies [8c60819]
- Updated dependencies [aca561a]
- Updated dependencies [e64a52e]
- Updated dependencies [844d17f]
- Updated dependencies [48132f7]
- Updated dependencies [4dcd52a]
- Updated dependencies [42ae5c6]
- Updated dependencies [0ef9dfd]
- Updated dependencies [1d723e3]
- Updated dependencies [0109f54]
- Updated dependencies [7e5bb5d]
- Updated dependencies [fbc23e0]
- Updated dependencies [6d762da]
- Updated dependencies [e6fdbdc]
- Updated dependencies [54233b1]
- Updated dependencies [f9faa7d]
- Updated dependencies [97b63d7]
- Updated dependencies [6bb454a]
- Updated dependencies [523be48]
- Updated dependencies [7e2b7e9]
- Updated dependencies [33526fd]
- Updated dependencies [32413ec]
- Updated dependencies [c1e1e6b]
  - @object-ui/components@17.4.0
  - @object-ui/react@17.4.0
  - @object-ui/core@17.4.0
  - @object-ui/i18n@17.4.0
  - @object-ui/types@17.4.0

## 17.3.0

### Patch Changes

- Updated dependencies [18cd432]
- Updated dependencies [532cf8b]
- Updated dependencies [680080a]
- Updated dependencies [a7651e6]
- Updated dependencies [d915c47]
- Updated dependencies [b71fc92]
- Updated dependencies [65516ba]
- Updated dependencies [94c5b7c]
- Updated dependencies [ca0fa8f]
- Updated dependencies [34595eb]
- Updated dependencies [3889ffb]
- Updated dependencies [5781fb1]
- Updated dependencies [7e2406a]
- Updated dependencies [9e9e9a9]
- Updated dependencies [56409c2]
- Updated dependencies [042e09d]
- Updated dependencies [9cbcbf4]
- Updated dependencies [85c4c9c]
- Updated dependencies [fd54c3e]
- Updated dependencies [4eeb932]
- Updated dependencies [5c856ec]
- Updated dependencies [23018cc]
- Updated dependencies [53811d1]
- Updated dependencies [68b6a28]
- Updated dependencies [0554e88]
- Updated dependencies [d915c47]
- Updated dependencies [f44d872]
- Updated dependencies [28b2e65]
- Updated dependencies [509104a]
- Updated dependencies [825bbe3]
- Updated dependencies [6195841]
- Updated dependencies [5dd0127]
- Updated dependencies [06632e9]
- Updated dependencies [a415684]
- Updated dependencies [a4cff5b]
- Updated dependencies [175bd79]
- Updated dependencies [5af2852]
- Updated dependencies [f833d3a]
- Updated dependencies [a6ec93d]
- Updated dependencies [2a9513d]
- Updated dependencies [71be406]
- Updated dependencies [d22ae31]
- Updated dependencies [c7ed4c3]
- Updated dependencies [2409e1d]
- Updated dependencies [789fe3e]
- Updated dependencies [8d8094a]
  - @object-ui/core@17.3.0
  - @object-ui/components@17.3.0
  - @object-ui/types@17.3.0
  - @object-ui/i18n@17.3.0
  - @object-ui/react@17.3.0

## 17.2.0

### Minor Changes

- c5ccbd5: Stop declaring 12 `@object-ui/data-objectstack` / `@object-ui/plugin-chatbot` /
  `@object-ui/plugin-list` symbols under names `@objectstack/spec` owns
  (objectui#3160, objectstack#4115 batch 6). All three packages leave the ledger.

  **Breaking for importers of `@object-ui/data-objectstack`** — four exported
  names changed, because the spec exports the same name for a _different_ thing:

  | was                   | now                         | what the spec's same-named export actually is                                            |
  | :-------------------- | :-------------------------- | :--------------------------------------------------------------------------------------- |
  | `CacheStats`          | `MetadataCacheStats`        | the platform `ICacheService` counters (`keyCount`, `memoryUsage`)                        |
  | `MetadataSaveOptions` | `MetadataClientSaveOptions` | options for writing a metadata item to a **file** (`format`, `path`, `indent`, `atomic`) |
  | `SecurityPolicy`      | `SecurityManagerPolicy`     | the package supply-chain policy (`autoScan`, licences, code signing, sandbox)            |
  | `ValidationError`     | `DataApiValidationError`    | a plain `{ field, message, code? }` entry in a validation report                         |

  Each pair is disjoint or nearly so — `MetadataSaveOptions` and `SecurityPolicy`
  share not one key with the spec type whose name they wore — so none of them was
  a dialect to reconcile; they were four unrelated concepts squatting on spec
  names. `DataApiValidationError` follows the `<what was validated>Validation<Error|Result>`
  convention registered on objectstack#4115 (`@object-ui/core` took
  `SchemaNodeValidationError` in batch 4). Its **runtime** `name` deliberately
  stays `'ValidationError'`: `normaliseClientError` and `@object-ui/react`'s
  error-message helper both sniff `err.name`, so that string is a wire contract,
  not a symbol.

  **Breaking for importers of `@object-ui/plugin-chatbot`** — `PendingActionRow`
  and `PendingActionStatus` are now re-exported from `@objectstack/spec/contracts`
  instead of hand-transcribed, which narrows them. The copies had drifted three
  ways, and each drift had **disabled a compile-time check** rather than merely
  differed from one:

  - `status: PendingActionStatus | string` — a union with `string` absorbs the
    literals, so that annotation carried no information at all;
  - `[key: string]: unknown` — the objectstack#4075 mechanism: an index signature
    makes every structural comparison against the spec answer "identical", however
    far the copy has drifted;
  - `created_at` / `updated_at`, which the service contract does not carry and no
    consumer in this repo reads.

  **Breaking for importers of `@object-ui/plugin-list`** — `ViewTab` is derived from the spec's `ViewTabSchema`
  — from its **input** side, because `pinned` / `isDefault` / `visible` carry
  `.default()`s and this component is handed authored metadata, not parsed output.
  That removes a renderer-side tolerance the copy carried: `visible` accepted
  `string | boolean` and the tab bar compared it against the literal `'false'`, a
  spelling no producer emits. `label` also stops being required (the spec makes it
  optional; `name` is the identifier) and `filter` stops being `any`.

  `ListView` and `UserFilters` keep their names as declared dialects: both are the
  React **renderers** of the spec types whose names they share, and each takes that
  spec type as a prop (`ListViewProps.schema`, `UserFiltersProps.config`) rather
  than restating its shape. `Tool` and `MessageContent` in `plugin-chatbot` are
  vendored Vercel AI Elements / Shadcn primitives — upstream's component API, not
  objectui's authored surface — so the guard now skips that directory the same way
  it already skips `components/src/ui/`, with a test that fails if any file there
  stops carrying its vendor banner.

  Scored `minor`, not `major`, per this repo's fixed-group rule — objectui's major
  tracks `@objectstack`, so breaking changes of our own ship as minor with the
  semantics spelled out above (see AGENTS.md §版本号策略). A `major` here would carry
  all 39 packages of the fixed group to `18.0.0` and off objectstack's 17.x line.

### Patch Changes

- Updated dependencies [4ae0ac4]
- Updated dependencies [696e3c1]
- Updated dependencies [bca45cc]
- Updated dependencies [a889e31]
- Updated dependencies [09d30a4]
- Updated dependencies [4bf612c]
- Updated dependencies [335041c]
- Updated dependencies [b414983]
- Updated dependencies [256f8cc]
- Updated dependencies [d9668a7]
- Updated dependencies [4b470b9]
- Updated dependencies [cb82705]
- Updated dependencies [f572849]
- Updated dependencies [f6e8d78]
- Updated dependencies [ea96284]
- Updated dependencies [d3584c6]
- Updated dependencies [a8ad6c0]
- Updated dependencies [444457c]
- Updated dependencies [850033c]
- Updated dependencies [022e4c3]
- Updated dependencies [009e25d]
- Updated dependencies [726b89c]
  - @object-ui/types@17.2.0
  - @object-ui/components@17.2.0
  - @object-ui/core@17.2.0
  - @object-ui/react@17.2.0
  - @object-ui/i18n@17.2.0

## 17.1.0

### Patch Changes

- 9a13622: **Read the agent catalog in the declared envelope too, before the server converts.**

  `GET /api/v1/ai/agents` is served by two producers — the framework dispatcher's
  degraded fallback when no AI service is registered, and cloud's `service-ai` — and
  it is one of the last SDK-addressable routes still answering outside the platform's
  declared `{ success: true, data }` envelope (objectstack#4053). `useAgents` read
  only `{ agents }` and a bare array, so the day either producer converts, the parse
  would miss.

  That miss is unusually dangerous on this particular route, which is why it is worth
  getting ahead of rather than fixing after. The catalog is not just data:
  `useAiSurfaceEnabled` gates the **entire AI surface** on `agents.length > 0`,
  because the route is access-filtered per caller and is therefore the only signal
  that is both edition- and user-aware (ADR-0068). An empty list is the correct
  answer for a seat-less user or a Community-Edition deployment with no `service-ai`
  — so a parse miss and the legitimate hidden state are **indistinguishable**: no
  error, no 403, no log, just the FAB, the top-bar link and the designer's "Ask AI"
  quietly gone for everyone.

  `extractAgentList` now folds all four shapes to the same list — a bare array,
  `{ agents }`, `{ success: true, data: [...] }`, and `{ success: true, data:
{ agents } }` — detecting the envelope the way `ObjectStackClient.unwrapResponse`
  does (a **boolean** `success`), so the two readers cannot disagree about what
  counts as one. Nine tests cover it; reverting to the previous two-shape read fails
  five of them.

  No behaviour change against any server shipping today: the shapes that worked
  before still parse identically. This only removes the lockstep requirement, so the
  server side can convert on its own schedule.

- Updated dependencies [62311b6]
- Updated dependencies [fc0272a]
- Updated dependencies [9e7349e]
- Updated dependencies [8864971]
- Updated dependencies [1cf0de7]
- Updated dependencies [752e18f]
- Updated dependencies [c785740]
- Updated dependencies [b41f401]
- Updated dependencies [19e9fa0]
- Updated dependencies [d61efd1]
- Updated dependencies [95b7214]
- Updated dependencies [7d9734d]
- Updated dependencies [6ae818e]
- Updated dependencies [9eb932b]
- Updated dependencies [746dd00]
- Updated dependencies [aebfa4f]
- Updated dependencies [38ca8be]
- Updated dependencies [3cb9646]
- Updated dependencies [68ef584]
- Updated dependencies [4952edf]
- Updated dependencies [7f0252e]
- Updated dependencies [c4d7b20]
- Updated dependencies [c769d3d]
- Updated dependencies [7639a61]
- Updated dependencies [94e63ef]
- Updated dependencies [c735bf7]
- Updated dependencies [02aef0c]
- Updated dependencies [6f29aa5]
- Updated dependencies [d21794c]
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
- Updated dependencies [ad0183a]
- Updated dependencies [ce08d55]
- Updated dependencies [eb4b740]
- Updated dependencies [5b084eb]
- Updated dependencies [aa1240a]
- Updated dependencies [2374a49]
- Updated dependencies [390c071]
- Updated dependencies [d10f526]
- Updated dependencies [2d5d594]
- Updated dependencies [ea7f477]
- Updated dependencies [379728f]
- Updated dependencies [7f23cd0]
- Updated dependencies [0ded602]
- Updated dependencies [24e0e0a]
- Updated dependencies [f8a95e5]
- Updated dependencies [3a6cf24]
- Updated dependencies [aa35561]
- Updated dependencies [03bd53b]
- Updated dependencies [3c1f321]
- Updated dependencies [a045a32]
- Updated dependencies [912496d]
- Updated dependencies [80edbd4]
- Updated dependencies [9867281]
  - @object-ui/core@17.1.0
  - @object-ui/components@17.1.0
  - @object-ui/react@17.1.0
  - @object-ui/types@17.1.0
  - @object-ui/i18n@17.1.0

## 17.0.0

### Patch Changes

- cfc675e: fix(i18n): unconditional Chinese in the chatbot confirm card and the field inspector (objectui#2884, objectui#2885)

  Two issues split out of the objectui#2871 survey because neither is a language
  _branch_ — both are copy that renders in Chinese for every user regardless of
  locale.

  **objectui#2884 — the confirm-before-change card.** Heading, buttons, hint and
  the verb column of each change row were Chinese literals, so an English user
  read the whole confirm gate in Chinese. They now follow the same
  prop-with-English-default convention the plan card already uses
  (`changesTitleLabel`, `changesConfirmLabel`, `changeVerbLabels`, …), with the
  console passing translated values from `console.ai.*`.

  The serious half was the outbound message. Clicking Confirm sent
  `'确认修改，应用你刚才提议的改动。'` unconditionally — an English user's click
  told the agent, in Chinese, to apply the changes, and the agent answered in
  Chinese for the rest of the thread. That message now routes through the same
  `convZh` (conversation-language) switch as `planApproveMessage`, so it matches
  the language actually being spoken rather than the UI or a hard-coded literal.

  Note this is deliberately _not_ "always send English": the repo already decided
  outbound agent text follows the CONVERSATION, and the cloud confirm gate
  (`service-ai-studio` `confirm-gate.ts` `APPROVAL_RE`) matches on approval
  keywords. The Chinese string is unchanged, so that path is byte-for-byte what
  the gate already accepted; `i18n.test.ts` now pins it against the mirrored gate
  regex alongside the two plan messages.

  Also in this component: the error banner's `Response failed` / `Details` /
  `Retry` were hard-coded English, and both it and the quota banner used a bare
  `t(key)` that renders the raw key when the chat is mounted without an
  `I18nProvider`. Both now use `useSafeTranslate`, so they degrade to English
  instead of to `chatbotError.title`. The `「…」` corner brackets around the
  target-app name are now neutral quotes.

  **objectui#2885 — the draft-field suffix.** `ObjectFieldInspector` appended a
  bare `(草稿)` to draft objects in the lookup picker — the only Chinese literal
  in a 1500-line file where the other 101 strings all go through `t(key, locale)`.
  It now reads `engine.inspector.draftSuffix` from the Studio catalog.

  The 18 new keys were added to all ten locale packs, so the objectui#2872 part
  (a) gap held at 469/471 rather than widening.

- 0502a7c: fix(i18n): the change card's Confirm button sent text the cloud gate does not accept

  The English `console.ai.changesConfirmMessage` was
  `"Confirm the changes — apply what you just proposed."`. The cloud confirm gate
  (`service-ai-studio` `confirm-gate.ts` `APPROVAL_RE`) recognises
  `apply (this|the) change` — **not** "apply what". So the message failed the
  gate, and failing the gate is silent: the agent re-proposes instead of applying,
  and the Confirm button on the change card simply looks inert.

  This affected English conversations **and all eight locales that fall back to
  English** for that key. It is now
  `"Confirm — apply the change you just proposed."` — singular "the change", so it
  still matches if the gate ever tightens to a word boundary. The Chinese string
  was always fine (`确认修改` hits the 确认-anchored clause) and is unchanged.

  The same literal lives in four places — the locale pack, the
  `ChatbotEnhanced` prop default, its doc comment, and the `AiChatPage`
  `defaultValue` — and all four are updated together.

  **Why the existing guard missed it.** `i18n.test.ts` mirrored only the _Chinese_
  clause of `APPROVAL_RE`; the English half was reduced to "starts with Confirm,
  contains apply" because nothing in this repo could see the real pattern. That
  weaker assertion passed against a string the gate rejected — the guard was
  green and the feature was broken.

  The mirror is now **verbatim, both clauses**, and drives an `it.each` over every
  outbound approval message in both `zh` and `en`. Two supporting tests keep it
  honest: one asserting the gate stays narrow (a plain build request like
  "帮我搭建一个 CRM" must NOT read as approval), and one asserting
  `planAnswerMessage` does _not_ match — it answers a structure question and must
  never read as blanket approval.

  The mirror is duplicated across a repo boundary by necessity (objectui cannot
  import from cloud); the comment says so, so the next person changing
  `APPROVAL_RE` knows to update it here too.

- 263f885: fix(i18n): delete the four `pick({en,zh})` clones (objectui#2871, part 2)

  Four files each carried an identical private resolver:

  ```ts
  function pick(label: I18n): string {
    const lang = document.documentElement.getAttribute("lang") || "en";
    return lang.toLowerCase().startsWith("zh") ? label.zh : label.en;
  }
  ```

  Only Chinese was ever handled, so ja/ko/de/fr/es/pt/ru/ar silently rendered
  English — and because the copy was baked into the components as inline
  `{en, zh}` pairs, no translator could reach it. All four copies are deleted
  along with their `I18n` type alias.

  Migrated to the locale packs, **all ten languages**:

  - `excelImport.*` (8 keys) — `ExcelImportBar`. The completion toast becomes a
    proper `{{count}}` / `{{object}}` interpolation instead of a template literal
    baked into both language variants.
  - `cloudOnboarding.*` (5 keys) — `CloudOnboardingNext`, the Cloud welcome page.
  - `aiModelStatus.*` (11 keys) — `CloudAiModelStatus`, including the
    `sourceLabel()` enum→prose helper (now `t`-driven with a `{{source}}`
    placeholder) and the three `ModelRow` labels. The conditional
    `(HTTP nnn)` fragment becomes two whole sentences rather than a string
    spliced mid-clause, which is not translatable into every word order.
  - `chatbotQuota.*` (4 keys) — the AI quota banner in `ChatbotEnhanced`.

  The chatbot banner keeps choosing between the server's `quota.message` (zh) and
  `quota.messageEn` — that pair is server-owned — but now decides using the
  console's active language instead of `navigator.language`, which had ignored
  the in-app locale switcher entirely.

  `CloudOnboardingNext`'s tests now render inside a real `I18nProvider`; without
  one `t()` returns the raw key, so the previous assertions on literal English
  were asserting nothing.

  This completes the `pick()` cluster from #2871. The remaining
  `startsWith('zh')` sites are the ones that classification marked KEEP —
  `LoadingScreen` (bootstrap, selects real locale packs before i18next is up),
  `conversationLanguage` (detects the chat's language for the agent, not UI
  copy), `containers.tsx` (normalises author-supplied schema data; its `'与'`
  separator is a CJK typography rule), and the Studio catalog / `field-types.ts`
  data catalog.

- Updated dependencies [7b21891]
- Updated dependencies [0b3be01]
- Updated dependencies [3c4d935]
- Updated dependencies [4b60d2d]
- Updated dependencies [952b978]
- Updated dependencies [de5e40c]
- Updated dependencies [1a03af6]
- Updated dependencies [3e886eb]
- Updated dependencies [cfc675e]
- Updated dependencies [20df08c]
- Updated dependencies [1767124]
- Updated dependencies [8ecf5a6]
- Updated dependencies [af705b9]
- Updated dependencies [0502a7c]
- Updated dependencies [7b35e4b]
- Updated dependencies [8fb1295]
- Updated dependencies [e16ed2d]
- Updated dependencies [c6fd752]
- Updated dependencies [f9bbddb]
- Updated dependencies [dfd3705]
- Updated dependencies [c77108c]
- Updated dependencies [2735de6]
- Updated dependencies [c19ac11]
- Updated dependencies [6dee2cb]
- Updated dependencies [e05f052]
- Updated dependencies [0502a7c]
- Updated dependencies [faad45e]
- Updated dependencies [09c6a17]
- Updated dependencies [c7cff19]
- Updated dependencies [ba73a02]
- Updated dependencies [cd09a7b]
- Updated dependencies [f1abf0e]
- Updated dependencies [f05b84e]
- Updated dependencies [9b4b952]
- Updated dependencies [2f947e4]
- Updated dependencies [7d46648]
- Updated dependencies [9b53d72]
- Updated dependencies [bb4aa25]
- Updated dependencies [75f1cdf]
- Updated dependencies [662bdf9]
- Updated dependencies [059a052]
- Updated dependencies [53642d4]
- Updated dependencies [8aae006]
- Updated dependencies [c6cfdf1]
- Updated dependencies [d147a13]
- Updated dependencies [c6aaed8]
- Updated dependencies [263f885]
- Updated dependencies [dc334da]
  - @object-ui/components@17.0.0
  - @object-ui/i18n@17.0.0
  - @object-ui/react@17.0.0
  - @object-ui/types@17.0.0
  - @object-ui/core@17.0.0

## 16.1.0

### Patch Changes

- 59db1f9: chore(lint): clear the baseline lint errors in plugin-chatbot (objectui#2713 Wave 3)

  Wave 3 of the #2713 lint-gate restoration. `@object-ui/plugin-chatbot` was red at
  baseline on `main`; cleared every **error** (no behavior change; warnings out of
  scope):

  - **`react-hooks/rules-of-hooks` in `useObjectChat` (8)** — the hook called
    DIFFERENT `useCallback`s in each of its two `isApiMode` return branches, so
    both sets were conditional (React throws if the mode toggles between renders).
    `useChat` was already called unconditionally; this destructures its result and
    hoists all eight callbacks (3 API + 5 local) above the `isApiMode` branch, so
    the same hooks run in the same order every render. Only the returned surface
    differs by mode — the callback bodies are unchanged (the API `messages` local
    is renamed `apiMessages`). Verified against the `useObjectChat.sendFailure` /
    `handoffContext` / `ChatbotEnhanced.sendError` suites.
  - **`react-hooks/rules-of-hooks` in `FloatingChatbotTrigger`** —
    `useChatbotLabel` wrapped the provider-safe `useObjectTranslation` in
    try/catch; removed the wrapper (the #2709 fix).
  - **`react-hooks/static-components` in `shimmer`** — `motion.create(Component)`
    genuinely builds a motion component and must key off the `as` prop, so it
    can't be module-scoped. Memoized per `Component` (stable across renders,
    avoids the remount) and carries a justified scoped disable at the render site.

- Updated dependencies [1c8935a]
- Updated dependencies [8b8b744]
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
- Updated dependencies [0a3710b]
- Updated dependencies [62b9ab5]
- Updated dependencies [1629313]
- Updated dependencies [29c6040]
- Updated dependencies [faebac3]
- Updated dependencies [2331ac9]
- Updated dependencies [199fa83]
- Updated dependencies [eee4ded]
  - @object-ui/core@16.1.0
  - @object-ui/types@16.1.0
  - @object-ui/react@16.1.0
  - @object-ui/components@16.1.0

## 16.0.0

### Patch Changes

- c0bd483: Plan-card approval gives immediate in-card feedback (#2627): clicking
  "Build it" flips the clicked card to a spinning "Building…" badge right away
  (the approval's chat-level effects land at the bottom of the thread, outside
  the viewport, so the card looked untouched for ~10s and users double-clicked).
  The durable Built state still derives from the message stream; an approval
  that never left the client (rate limit / offline) rolls the badge back so the
  button returns. New `planBuildingLabel` prop (AiChatPage passes zh).
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
  - @object-ui/core@16.0.0

## 15.0.0

### Patch Changes

- @object-ui/types@15.0.0
- @object-ui/core@15.0.0
- @object-ui/react@15.0.0
- @object-ui/components@15.0.0

## 14.1.0

### Patch Changes

- 82441e4: feat(console-ai): proactive AI usage indicator in the ChatDock (ADR-0057 #8)

  Surfaces remaining AI headroom **before** a send hits the 429 wall, instead of
  only learning the limit reactively.

  - **AiUsageIndicator** — two meters (build + dataChat) as small progress rings in
    the ChatDock header (desktop rail + mobile sheet). Near-full → an amber
    "running low" hint and a popover with "resets tonight / next cycle" plus the
    upgrade / top-up CTA (reusing the 429 deep-link). D5-safe: fractions and
    qualitative words only, never a token number. Hides itself when the usage
    endpoint is absent (older backend / OSS / no seat).
  - **useAiUsage** — fetches the D5-safe per-meter fractions; refetches on the chat
    engine's post-turn / 429 nudge and on tab re-focus; fails soft to nothing.
  - **useObjectChat** emits `AI_USAGE_REFRESH_EVENT` on a rejected send (429) and on
    the turn-finish edge so the ring updates right after the user's action.
  - i18n: `console.ai.usage.*` in en + zh-CN.

  Consumes the cloud `GET /api/v1/ai/usage` endpoint (objectstack-ai/cloud#824).

- Updated dependencies [0890fa7]
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
  - @object-ui/core@14.1.0
  - @object-ui/types@14.1.0
  - @object-ui/react@14.1.0
  - @object-ui/components@14.1.0

## 14.0.0

### Minor Changes

- 7b4fc36: feat(console-ai): ask→build handoff carries conversation context (ADR-0057 P4 / cloud#817)

  The P4 "Open in Builder →" handoff previously carried only the build prompt + an
  optional package, so the Builder started cold and the user re-explained
  themselves. It now also carries the **source `ask` conversation** as context —
  ADR-0057 P4 / cloud#817 — so the build agent's first turn starts with the thread
  the user already had.

  - `@object-ui/app-shell`: both handoff sites (the full-page `AiChatPage` and the
    console FAB) now append `?parentConversationId=<ask thread id>` to the
    `/ai/build` URL. The build surface reads it and forwards it to `useObjectChat`;
    the existing URL-mirror drops it once the build conversation id is minted, so a
    reload never re-carries it.
  - `@object-ui/plugin-chatbot`: `useObjectChat` accepts `parentConversationId` and
    sends it as `context.parentConversationId` on the **first turn only** (held in a
    ref, consumed once) — the backend redeems it into the turn's context and the
    client owns history from there. New pure helper `withHandoffContext` (unit
    tested) does the non-mutating `context` merge.

  Requires the cloud handoff-context contract (service-ai, cloud#817): the build
  agent redeems `context.parentConversationId` into a single system block on its
  first turn — ownership-checked, and carrying only the user/assistant text the
  user already saw (ADR-0063 governance boundary). Without it the console degrades
  cleanly: the id is sent but ignored, and the handoff is a (working) cold start.

- 7dea792: feat(console-ai): explicit "Open in Builder →" ask→build handoff (ADR-0057 P4)

  When the `ask` agent declines an app-authoring request it now calls the cloud
  `suggest_builder` tool (structured decline). The console renders that as an
  explicit **"Open in Builder →"** action that opens the full-page build surface
  seeded with the handoff prompt — ADR-0063 decline-and-redirect: an explicit,
  user-initiated switch, never a silent re-route into authoring.

  - `@object-ui/plugin-chatbot`: `detectBuilderHandoff` lifts the
    `{ status:'build_handoff', prompt, packageId? }` result onto the tool
    invocation; `ChatbotEnhanced` renders the "Open in Builder →" card and calls a
    new `onOpenBuilder` prop (disabled when no host wires it).
  - `@object-ui/app-shell`: the full-page `AiChatPage` (`ask`) and the console FAB
    wire `onOpenBuilder` to navigate to `/ai/build?package=…&handoffPrompt=…`; the
    build surface seeds that prompt as its first message (auto-sent once the
    conversation is minted), and the URL-mirror strips `?handoffPrompt` so a reload
    never re-sends it. Full ask-conversation context transfer is a later upgrade
    (cloud#817); v1 carries the build prompt + optional package.

  Requires the cloud `suggest_builder` signal (service-ai-studio) to light up; the
  console degrades cleanly (no card) without it.

- 9d0fdb1: feat(console-ai): render agent behavior by declared capability (cloud#816 / ADR-0057 "B+")

  `GET /api/v1/ai/agents` now serves per-agent `capabilities`; the console
  consumes them instead of hard-coding `isBuildAgent(name)`:

  - `@object-ui/plugin-chatbot`: `AgentDescriptor.capabilities` (normalized from
    the catalog) + new `agentHasCapability(agents, name, cap)` — declaration wins
    when present; falls back to the legacy `isBuildAgent(name)` check when absent
    (older server), so shipping order doesn't matter.
  - `@object-ui/app-shell`: the build-doctor drawer + `showDebug` key off
    `'debug'`, the FAB's resume-vs-fresh keys off `'resume'`, HomePage's
    "Build with AI" availability keys off `'authoring'`. The ADR-0063 product-axis
    sites (surface→agent resolver, conversation scope keying, picker availability)
    intentionally stay name-based — capability describes RENDERED behavior, not
    which product an agent is.

  A future skill-driven build variant now needs no console change.

- cd778d4: feat(console-ai): package binding chip + inert handoff cards + honest send hint (#2458 / ADR-0057 A1.a)

  Three UX improvements from live magic-flow testing:

  - **A1.a — package binding chip** (`app-shell`): the build surface header shows
    the package the conversation is bound to (`📦 <app>`), or **"New app"** when
    unbound — so the edit blast-radius is always visible (Claude-Code-shows-the-repo
    idiom). The magic flow starts unbound and binds the moment its build mints a
    package (`deriveBoundPackageId` reads `?package=` else the latest draft/handoff
    result; unit-tested).
  - **UX#5 — only the latest handoff card is actionable** (`plugin-chatbot`): when
    a thread accumulates several "Open in Builder →" cards, only the newest stays
    clickable; older (superseded) cards' buttons are disabled — derived from
    message order, so it survives the navigation the button triggers and the pane
    remount that follows. A stale prompt in an older card can't be re-fired.
  - **UX#7 — honest send hint** (`plugin-chatbot`): the composer already sends on
    plain Enter (Shift+Enter = newline); dropped the misleading `⌘` glyph from the
    hint so it no longer implies Cmd+Enter.

### Patch Changes

- 1273f1e: fix(console-ai): reliable ask→build handoff auto-send + second-handoff context re-carry (ADR-0057 P4)

  Two follow-ups to the P4 "Open in Builder →" handoff:

  - **Auto-send swallow.** The handoff's auto-sent first message could be dropped on
    a brand-new build conversation: the seed gated on the async-resolved
    `activeAgent`, which can settle _after_ the conversation id is minted, so the
    deferred-send replay ran with an empty pending and never re-fired. The seed now
    gates on the **route** (`agentSegment`, synchronous) and bumps a `pendingSignal`
    that `useDeferredFirstSend` lists in its replay deps, so the seed always fires —
    no more empty build conversation on handoff.

  - **Second-handoff re-carry.** A second "Open in Builder →" into the (singleton)
    build conversation now re-carries the latest ask context. The transport re-arms
    `parentConversationId` on each falsy→truthy transition of the prop (the ask
    thread is a singleton, so the same id repeats — the fresh-arrival signal is the
    transition the URL-mirror produces, not a changed value), and the seed re-arms
    on each new `handoffPrompt`.

  Unit-tested: deferred-send replays a post-id seed via the signal; the transport
  re-carries across a strip→re-supply cycle.

- bfea27f: Make the ask-decline wait feel responsive: live thinking indicator + handoff card the moment `suggest_builder` lands (#2458 item 3).

  When the `ask` agent declines a build-shaped request, the ~20s before the "Open in Builder →" card is dominated by the LLM's time-to-tool-call. During that wait the chat could show dead air — a blank bubble, or the static "执行过程" activity note (a hydrated-history affordance) when the backend streamed a `(called …)` tool-call placeholder.

  `ChatbotEnhanced` now shows the existing live thinking indicator (`ThinkingDots`) whenever a streaming assistant turn has nothing visible yet — including whitespace-only content, a mid-stream `(called …)` placeholder, and hidden reasoning in `summary` mode. The static "执行过程" note is reserved for FINISHED (re-hydrated) tool-call-only turns (#772 preserved). The `builderHandoff` card already renders at `output-available` with no gate on the trailing prose, so it surfaces the instant the tool result arrives; the typing cursor now only paints beside real streaming prose (no lone cursor during the tool phase).

- 408f4ba: fix(plugin-chatbot): build-result summary truncates on mobile instead of overflowing (#2493)

  The draft-review card's summary line (`built N artifact(s) — …`) is a nowrap
  `truncate` span, but its flex row lacked the `min-w-0` that lets `truncate`
  actually bite — so on a phone the long summary expanded the chat column past
  the viewport and the whole chat scrolled sideways. The span now gets
  `min-w-0 flex-1` (truncating within the row) and the action row is `flex-wrap`
  so its buttons drop to a new line on a narrow screen rather than forcing
  horizontal scroll. Desktop is unchanged (there's room, so nothing wraps or
  truncates).

- Updated dependencies [443360a]
- Updated dependencies [86c69c3]
- Updated dependencies [05e56ca]
- Updated dependencies [a44e7b6]
- Updated dependencies [6a74160]
  - @object-ui/core@14.0.0
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
  - @object-ui/core@13.2.0

## 13.1.0

### Patch Changes

- @object-ui/types@13.1.0
- @object-ui/core@13.1.0
- @object-ui/react@13.1.0
- @object-ui/components@13.1.0

## 13.0.0

### Patch Changes

- Updated dependencies [ac04b76]
- Updated dependencies [619097e]
  - @object-ui/components@13.0.0
  - @object-ui/types@13.0.0
  - @object-ui/react@13.0.0
  - @object-ui/core@13.0.0

## 12.1.0

### Patch Changes

- Updated dependencies [6cbccf3]
- Updated dependencies [c31874d]
  - @object-ui/components@12.1.0
  - @object-ui/types@12.1.0
  - @object-ui/react@12.1.0
  - @object-ui/core@12.1.0

## 12.0.0

### Patch Changes

- Updated dependencies [226fde9]
- Updated dependencies [e4de456]
  - @object-ui/types@12.0.0
  - @object-ui/core@12.0.0
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
  - @object-ui/core@11.5.0

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
  - @object-ui/core@11.4.0
  - @object-ui/react@11.4.0

## 11.3.0

### Minor Changes

- 8d351f1: chore(chatbot): upgrade to Vercel AI SDK v7 / @ai-sdk/react v4

  Bump `ai` ^6 -> ^7 and `@ai-sdk/react` ^3 -> ^4. The chatbot's `useChat`,
  `DefaultChatTransport`, `UIMessage`/`ChatStatus` usage and the `mapMessages`
  parts adapter are all source-compatible with v7 — no code changes required.

  Verified: type-check clean, build green, 183/183 unit tests pass on v7.

  Part of the org-wide AI SDK v6->v7 / providers v3->v4 upgrade (framework#2464,
  cloud#710).

### Patch Changes

- Updated dependencies [d88c8ec]
- Updated dependencies [b7237bb]
- Updated dependencies [d23d6eb]
  - @object-ui/components@11.3.0
  - @object-ui/core@11.3.0
  - @object-ui/react@11.3.0
  - @object-ui/types@11.3.0

## 11.2.0

### Patch Changes

- Updated dependencies [9e7a986]
- Updated dependencies [1311749]
  - @object-ui/components@11.2.0
  - @object-ui/core@11.2.0
  - @object-ui/react@11.2.0
  - @object-ui/types@11.2.0

## 11.1.0

### Minor Changes

- 27bef5a: feat(ai-build): event-driven "Designing your app…" progress for the blueprint-design stream (Refs cloud#657, cloud#655)

  `propose_blueprint` now streams a reconciled `data-blueprint-progress` part while it drafts the plan (a tens-of-seconds, otherwise-opaque LLM call), so the chat shows the app taking shape — objects appearing one-by-one with their field counts, the summary / extend target revealed progressively, and a `seq`-driven liveness cue — instead of a purely presentational rotating-hint placeholder.

  - `mapMessages`: `uiMessageToChatMessage` lifts the latest `data-blueprint-progress` frame onto `ChatMessage.blueprintProgress` (same single-reconciled-part mechanism as `data-build-progress`; transient, never persisted). This is the shared streaming converter both the full-page AI Build surface (`AiChatPage` via `useObjectChat`) and the floating console chatbot already route through.
  - `ChatbotEnhanced`: a new `BlueprintProgressPanel` renders the live "Designing…" card (object chips + summary + running counts + liveness). It supersedes the rotating-hint placeholder while events flow, and yields to the authoritative "Proposed plan" card the instant the `propose_blueprint` result lands.
  - Graceful degradation: with no `data-blueprint-progress` events (older runtimes / non-streaming turns) the existing rotating-hint placeholder behaves exactly as before — zero regression. On reload the persisted "Proposed plan" card is the record (the live panel is transient by design).

### Patch Changes

- @object-ui/components@11.1.0
- @object-ui/react@11.1.0
- @object-ui/types@11.1.0
- @object-ui/core@11.1.0

## 7.3.0

### Patch Changes

- @object-ui/types@7.3.0
- @object-ui/core@7.3.0
- @object-ui/react@7.3.0
- @object-ui/components@7.3.0

## 7.2.0

### Patch Changes

- Updated dependencies [d23db5c]
  - @object-ui/types@7.2.0
  - @object-ui/components@7.2.0
  - @object-ui/react@7.2.0
  - @object-ui/core@7.2.0

## 7.1.0

### Patch Changes

- Updated dependencies [677f7ed]
- Updated dependencies [08c47da]
- Updated dependencies [a71be60]
- Updated dependencies [cb03bc3]
  - @object-ui/types@7.1.0
  - @object-ui/core@7.1.0
  - @object-ui/react@7.1.0
  - @object-ui/components@7.1.0

## 7.0.0

### Minor Changes

- 81c0777: feat(studio): ADR-0033 Phase B — draft review surface (chat → designer → generic diff)

  Closes the AI metadata-authoring loop in Studio. The framework (ADR-0033 Phases A + C) makes the assistant stage every change as a DRAFT; this lets a human see and review those drafts.

  **`@object-ui/plugin-chatbot`**

  - `mapMessages` now detects the framework's draft envelopes — `{ status:'drafted', type, name, … }` (single) and `{ status:'drafted', drafted:[{type,name}] }` (apply_blueprint batch) — and lifts the reviewable targets onto `ChatToolInvocation.draftReview` (mirrors the existing HITL `pendingActionId` path; the Vercel `{type:'text',value}` wrapper is peeled). `blueprint_proposed` is intentionally not surfaced (no draft yet).
  - `ChatbotEnhanced` renders a **"Review N change(s)"** button on drafted tool results, driven by a new `onReviewDraft` callback prop.

  **`@object-ui/app-shell`**

  - `assistantBus` gains a review channel (`requestReview` / `requestAssistantReview`); `ConsoleFloatingChatbot` wires the chat button to it; a small navigator inside `AppContent` (which knows the app base) routes to `/apps/:appName/metadata/:type/:name?review=1`.
  - `ResourceEditPage` honours `?review=1`: it force-reloads the pending draft (covers the case where the AI drafted the item after the page mounted) and opens the review/diff.
  - New **`DraftReviewPanel`** — a generic, type-agnostic draft↔published structural diff (added / changed / removed by key), reusing `LayeredDiff`'s `computeDiffRows`. It gives **every** metadata type (view, dashboard, flow, …) a real "what will publishing change" review, surfaced as a toolbar affordance + sheet whenever a draft exists. The object designer keeps its richer per-field review.

  Nothing is published by any of this — the human still clicks Publish.

- 9049bbe: Add end-user friendly agent process summaries for chatbot tool calls, with a debug mode for raw reasoning and tool details. Console chat surfaces now keep a sanitized browser-side display cache so refreshes can restore user/assistant text plus grouped tool states when the backend returns no message rows.
- 053c948: feat(plugin-chatbot): render AI data-query charts inline (`data-chart`)

  Companion to the framework `visualize_data` tool: the data-query assistant can
  now answer with a CHART rendered right in the assistant bubble.

  - `mapMessages.ts` — `extractCharts()` lifts every `data-chart` custom stream
    part onto `ChatMessage.charts` (defensive narrowing; preserves multiple charts
    in order), mirroring the existing `data-build-progress` → `buildProgress` path.
  - `ChatbotEnhanced.tsx` — renders each chart via `<SchemaRenderer schema={{
type:'chart', … }}/>` (decoupled — no hard dep on `plugin-charts`), giving the
    chart a definite `width: min(520px, 80vw)` so recharts' `ResponsiveContainer`
    measures a stable non-zero width inside the `w-fit` bubble (otherwise the
    circular width dependency leaves bars unpainted).

- 053c948: feat(plugin-chatbot): honest liveness indicator on running AI turns

  AI app builds run 1–3 min with long quiet gaps (LLM thinking, sample-data
  generation) where a static spinner is indistinguishable from a dropped
  connection. The chat now shows a Claude-Code-style liveness indicator driven by
  REAL observed stream activity, not a free-running clock:

  - `useTurnLiveness(active, activityKey)` stamps the moment real data arrives (a
    streamed token / tool delta / `data-build-progress` update) and measures
    seconds-since-last-byte.
  - `LivenessIndicator` renders three honest states — _receiving_ (emerald pulse +
    m:ss, bytes arrived recently), _waiting_ (request in flight, nothing back yet),
    and _stalled_ (amber + "no response for Ns", genuinely silent past 6s).
  - The build panel prefers the server's monotonic `seq` keep-alive heartbeat as
    its activity key (falling back to the content signature on older runtimes), so
    a long quiet seed-generation window reads as honestly _receiving_ rather than
    flipping to amber.

### Patch Changes

- 40c79df: Improve the floating chatbot flow with responsive panel bounds, safer FAB placement, inline responding and stop states, and clearer retryable error feedback.
- Updated dependencies [5976ba3]
- Updated dependencies [a00e16d]
- Updated dependencies [eaccefd]
- Updated dependencies [f7f325d]
- Updated dependencies [c12986e]
- Updated dependencies [71d7ce0]
- Updated dependencies [053c948]
- Updated dependencies [ddbe4a2]
- Updated dependencies [2d47e94]
- Updated dependencies [9049bbe]
- Updated dependencies [6c0c92c]
- Updated dependencies [cb2fdb1]
- Updated dependencies [c3749eb]
- Updated dependencies [6cfa330]
- Updated dependencies [ad8ade6]
- Updated dependencies [d54346c]
- Updated dependencies [3870c20]
- Updated dependencies [2eb3096]
- Updated dependencies [b88c560]
- Updated dependencies [d16566f]
- Updated dependencies [90acb7f]
- Updated dependencies [7913390]
- Updated dependencies [1394e34]
- Updated dependencies [e95cc25]
- Updated dependencies [abe8ebc]
- Updated dependencies [300d755]
- Updated dependencies [bd8b054]
- Updated dependencies [4eb9cb6]
- Updated dependencies [7c239fd]
- Updated dependencies [858ad94]
- Updated dependencies [2270239]
- Updated dependencies [8d1195d]
  - @object-ui/core@7.0.0
  - @object-ui/components@7.0.0
  - @object-ui/react@7.0.0
  - @object-ui/types@7.0.0

## 6.2.3

### Patch Changes

- @object-ui/types@6.2.3
- @object-ui/core@6.2.3
- @object-ui/react@6.2.3
- @object-ui/components@6.2.3

## 6.2.2

### Patch Changes

- Updated dependencies [a66f788]
  - @object-ui/react@6.2.2
  - @object-ui/components@6.2.2
  - @object-ui/types@6.2.2
  - @object-ui/core@6.2.2

## 6.2.1

### Patch Changes

- @object-ui/types@6.2.1
- @object-ui/core@6.2.1
- @object-ui/react@6.2.1
- @object-ui/components@6.2.1

## 6.2.0

### Minor Changes

- 0335ec4: Polish the AI chat surface based on real-world dogfooding feedback.

  **`@object-ui/plugin-chatbot`** — new display helpers shared by `ChatbotEnhanced`:

  - `unwrapToolResult(value)` peels the MCP-style `{ type: 'text', value: '<json>' }`
    envelope that backend tools emit (`@objectstack/service-ai`'s data/metadata
    tools, in particular), and JSON-parses the inner payload. The result panel
    now renders a structured object tree instead of a doubly-escaped wall of
    `\\\"objects\\\":[…]`.
  - `humanizeToolName(name)` converts snake_case / kebab-case / camelCase tool
    ids into sentence case ("list_objects" → "List objects"), preserving known
    acronyms (API, ID, SQL, …). Tool-call cards now show the friendly title with
    the raw id as a small monospace badge for power users.
  - `summarizeChatError(err)` strips the AI SDK's
    `"Failed after N attempts. Last error: "` prefix and keeps the first
    sentence as a headline; the full text is exposed via an optional `details`
    field so the new error banner can render a "Details" disclosure plus a
    prominent Retry button instead of a 300-character single-line wall.

  A new `⌘⏎ to send` hint is shown in the prompt footer (hidden on narrow
  screens). `ToolHeader.title` now accepts `ReactNode` (previously `string`)
  so wrappers can compose richer titles.

  **`@object-ui/app-shell`** — `AiChatPage`:

  - Removes the fake "Hello! I'm X" assistant welcome bubble so the empty-state
    suggestion chips can actually render.
  - Adds per-agent default suggestion sets (`data_chat`, `metadata_assistant`)
    with a generic fallback. New conversations open with three actionable
    starter prompts tailored to the selected agent.
  - Surfaces agent-fetch failures as an inline warning on the agent picker
    instead of hijacking the welcome message.
  - Placeholder text now hints at the first suggestion (e.g. `Ask Data
Assistant…  (try "系统里有多少个用户？")`).

### Patch Changes

- @object-ui/react@6.2.0
- @object-ui/components@6.2.0
- @object-ui/types@6.2.0
- @object-ui/core@6.2.0

## 6.1.0

### Patch Changes

- Updated dependencies [991b62d]
  - @object-ui/core@6.1.0
  - @object-ui/types@6.1.0
  - @object-ui/components@6.1.0
  - @object-ui/react@6.1.0

## 6.0.4

### Patch Changes

- @object-ui/types@6.0.4
- @object-ui/core@6.0.4
- @object-ui/react@6.0.4
- @object-ui/components@6.0.4

## 6.0.3

### Patch Changes

- @object-ui/types@6.0.3
- @object-ui/core@6.0.3
- @object-ui/react@6.0.3
- @object-ui/components@6.0.3

## 6.0.2

### Patch Changes

- @object-ui/types@6.0.2
- @object-ui/core@6.0.2
- @object-ui/react@6.0.2
- @object-ui/components@6.0.2

## 6.0.1

### Patch Changes

- @object-ui/types@6.0.1
- @object-ui/core@6.0.1
- @object-ui/react@6.0.1
- @object-ui/components@6.0.1

## 6.0.0

### Minor Changes

- 451bbee: **HITL conversation loop:** `useHitlInChat` now accepts a
  `continueConversation(prompt, ctx)` callback. After the operator approves
  or rejects a tool call from inline chat buttons, the hook synthesises a
  short follow-up user prompt (tagged `[HITL pa_xxx]`, with the executed
  result or rejection reason) and invokes the callback so the LLM
  continues the conversation with full awareness of the outcome.

  `ConsoleFloatingChatbot` wires this callback to `useObjectChat`'s
  `sendMessage`, closing the loop end-to-end. Execution failures stay
  visible in the inline status badge but do NOT continue automatically —
  the operator decides next steps.

  No framework changes required. Internal `idMap` now also tracks the
  tool name so the synthesised prompt is human-readable. New test suite
  `useHitlInChat.test.tsx` covers approve/reject/failed/no-callback
  branches.

### Patch Changes

- @object-ui/types@6.0.0
- @object-ui/core@6.0.0
- @object-ui/react@6.0.0
- @object-ui/components@6.0.0

## 5.4.2

### Patch Changes

- @object-ui/types@5.4.2
- @object-ui/core@5.4.2
- @object-ui/react@5.4.2
- @object-ui/components@5.4.2

## 5.4.1

### Patch Changes

- @object-ui/types@5.4.1
- @object-ui/core@5.4.1
- @object-ui/react@5.4.1
- @object-ui/components@5.4.1

## 5.4.0

### Minor Changes

- 3a8c754: Rebuilt the chatbot UI on top of **Vercel AI Elements** (MIT) and wired in
  the v1 capabilities exposed by `@objectstack/service-ai` (tracing,
  `generateObject`, `query_data` tool, `ModelRegistry`).
  - **What's new**
    - `ChatbotEnhanced` is now composed from `Conversation`, `Message`,
      `PromptInput`, `Suggestion`, `Tool`, `Reasoning`, `Sources`, and friends.
      Sticky-to-bottom scrolling, keyboard-aware textarea, file pill chips,
      copy/retry actions, and the streaming/error banners now match the
      shadcn-style AI surface used across the ecosystem.
    - **Tool / reasoning / sources rendering**: assistant messages with
      `toolInvocations`, `reasoning`, or `sources` automatically render the
      collapsible tool panels, the chain-of-thought block, and the citation
      pill. `useObjectChat` parses these directly from `vercel/ai`'s
      `UIMessage.parts` stream — no extra wiring needed at the call site.
    - **Model picker**: optional `models` + `selectedModelId` + `onModelChange`
      props render an inline `<select>` in the prompt-input toolbar. Designed
      to be fed straight from `GET /api/v1/ai/models` (new in service-ai
      v1).
    - **Trace links**: new optional `traceId` on `ChatMessage` surfaces a
      small "trace" link on assistant messages — pair with the `ai_traces`
      object exposed by service-ai's auto-tracing.
    - New optional `suggestions?: string[]` prop renders a chip row in the
      empty state and forwards the picked suggestion to `onSendMessage`.
    - All vendored AI Elements (10 components) plus two missing shadcn
      primitives (`button-group`, `input-group`) are exported as a namespace —
      `import { AIElements } from '@object-ui/plugin-chatbot'` — so apps can
      compose bespoke chat surfaces without dropping back to the legacy
      primitives.
  - **Type-level changes**
    - `@object-ui/types` `ChatMessage` gains optional `reasoning`, `sources`,
      `traceId` fields, and a new `ChatMessageSource` interface.
    - `ChatToolInvocation` accepts the AI SDK v6 lifecycle states
      (`input-streaming`/`input-available`/`output-available`/`output-error`/
      …) in addition to the legacy `partial-call`/`call`/`result`. `args`
      is now optional and accepts arbitrary shapes; new optional `errorText`
      field.
  - **What hasn't changed**
    - Public prop signature on `FloatingChatbot`, `FloatingChatbotPanel`, and
      the SDUI `"chatbot"` renderer.
    - Hook contracts: `useObjectChat`, `useAgents`,
      `useFloatingChatbot`.
    - SSR / Tailwind 4 / React 18+19 support.
  - **Under the hood**
    - New deps: `streamdown`, `use-stick-to-bottom`, `shiki`, `motion`,
      `nanoid`, `@radix-ui/react-use-controllable-state`,
      `@radix-ui/react-slot`, `class-variance-authority`.
    - Vendored sources live under `src/elements/` with header comments pointing
      back to `registry.ai-sdk.dev`. Rule #7 No-Touch Zones are respected —
      `packages/components/src/ui/**` was not modified.

### Patch Changes

- Updated dependencies [3a8c754]
  - @object-ui/types@5.4.0
  - @object-ui/components@5.4.0
  - @object-ui/core@5.4.0
  - @object-ui/react@5.4.0

## 5.3.2

### Patch Changes

- @object-ui/types@5.3.2
- @object-ui/core@5.3.2
- @object-ui/react@5.3.2
- @object-ui/components@5.3.2

## 5.3.1

### Patch Changes

- @object-ui/types@5.3.1
- @object-ui/core@5.3.1
- @object-ui/react@5.3.1
- @object-ui/components@5.3.1

## 5.3.0

### Patch Changes

- @object-ui/types@5.3.0
- @object-ui/core@5.3.0
- @object-ui/react@5.3.0
- @object-ui/components@5.3.0

## 5.2.1

### Patch Changes

- @object-ui/types@5.2.1
- @object-ui/core@5.2.1
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
- Updated dependencies [d1442e3]
- Updated dependencies [7c7400a]
  - @object-ui/types@5.2.0
  - @object-ui/core@5.2.0
  - @object-ui/react@5.2.0
  - @object-ui/components@5.2.0

## 5.1.1

### Patch Changes

- Updated dependencies [8955b9c]
  - @object-ui/components@5.1.1
  - @object-ui/types@5.1.1
  - @object-ui/core@5.1.1
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
  - @object-ui/core@5.1.0

## 5.0.2

### Patch Changes

- @object-ui/components@5.0.2
- @object-ui/react@5.0.2
- @object-ui/types@5.0.2
- @object-ui/core@5.0.2

## 5.0.1

### Patch Changes

- @object-ui/types@5.0.1
- @object-ui/core@5.0.1
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
  - @object-ui/core@5.0.0

## 4.8.0

### Patch Changes

- @object-ui/types@4.8.0
- @object-ui/core@4.8.0
- @object-ui/react@4.8.0
- @object-ui/components@4.8.0

## 4.7.0

### Patch Changes

- @object-ui/types@4.7.0
- @object-ui/core@4.7.0
- @object-ui/react@4.7.0
- @object-ui/components@4.7.0

## 4.6.0

### Patch Changes

- Updated dependencies [3ee436d]
  - @object-ui/components@4.6.0
  - @object-ui/types@4.6.0
  - @object-ui/core@4.6.0
  - @object-ui/react@4.6.0

## 4.5.0

### Patch Changes

- Updated dependencies [ab5e281]
- Updated dependencies [6b6afd1]
- Updated dependencies [aa7855f]
- Updated dependencies [170d89f]
  - @object-ui/types@4.5.0
  - @object-ui/components@4.5.0
  - @object-ui/core@4.5.0
  - @object-ui/react@4.5.0

## 4.4.0

### Patch Changes

- Updated dependencies [2bd45af]
  - @object-ui/components@4.4.0
  - @object-ui/types@4.4.0
  - @object-ui/core@4.4.0
  - @object-ui/react@4.4.0

## 4.3.1

### Patch Changes

- Updated dependencies [6b683c8]
  - @object-ui/components@4.3.1
  - @object-ui/react@4.3.1
  - @object-ui/types@4.3.1
  - @object-ui/core@4.3.1

## 4.3.0

### Patch Changes

- Updated dependencies [4e7bc1b]
- Updated dependencies [8442c05]
  - @object-ui/components@4.3.0
  - @object-ui/react@4.3.0
  - @object-ui/types@4.3.0
  - @object-ui/core@4.3.0

## 4.2.1

### Patch Changes

- @object-ui/types@4.2.1
- @object-ui/core@4.2.1
- @object-ui/react@4.2.1
- @object-ui/components@4.2.1

## 4.2.0

### Patch Changes

- @object-ui/components@4.2.0
- @object-ui/react@4.2.0
- @object-ui/types@4.2.0
- @object-ui/core@4.2.0

## 4.1.0

### Patch Changes

- @object-ui/types@4.1.0
- @object-ui/core@4.1.0
- @object-ui/react@4.1.0
- @object-ui/components@4.1.0

## 4.0.12

### Patch Changes

- @object-ui/types@4.0.12
- @object-ui/core@4.0.12
- @object-ui/react@4.0.12
- @object-ui/components@4.0.12

## 4.0.11

### Patch Changes

- @object-ui/components@4.0.11
- @object-ui/react@4.0.11
- @object-ui/types@4.0.11
- @object-ui/core@4.0.11

## 4.0.10

### Patch Changes

- @object-ui/types@4.0.10
- @object-ui/core@4.0.10
- @object-ui/react@4.0.10
- @object-ui/components@4.0.10

## 4.0.9

### Patch Changes

- @object-ui/types@4.0.9
- @object-ui/core@4.0.9
- @object-ui/react@4.0.9
- @object-ui/components@4.0.9

## 4.0.8

### Patch Changes

- @object-ui/components@4.0.8
- @object-ui/react@4.0.8
- @object-ui/types@4.0.8
- @object-ui/core@4.0.8

## 4.0.7

### Patch Changes

- Updated dependencies [7c9b85c]
  - @object-ui/core@4.0.7
  - @object-ui/react@4.0.7
  - @object-ui/components@4.0.7
  - @object-ui/types@4.0.7

## 4.0.6

### Patch Changes

- 1b6dc64: fix: complete Tailwind v3→v4 migration cleanup

  - Rename deprecated `flex-shrink-0` → `shrink-0` and `flex-grow-N` →
    `grow-N` (Tailwind v4 dropped the long-form aliases). Affects
    data-table, fields/index, FileField, ChatbotEnhanced,
    FloatingChatbotPanel, ProcessDesigner, HistoryPanel, KanbanEnhanced,
    KanbanImpl, plugin-timeline index, FlowDesigner, LayoutRenderer.
  - Replace `theme(spacing.4)` inside arbitrary-value `[calc(...)]` with
    literal `1rem` in sidebar.tsx — `theme()` is deprecated in v4.
  - Remove obsolete v3-escape CSS overrides from index.css and
    sidebar-fixes.css. The component source now uses native v4 stacked
    data variants (`group-data-[state=collapsed]:group-data-[collapsible=icon]:w-(--sidebar-width-icon)`)
    which Tailwind v4 emits correctly without the manual overrides.
    Only the bespoke `.sidebar-menu-button-icon-mode*` rules are kept.

- Updated dependencies [925051d]
- Updated dependencies [1b6dc64]
  - @object-ui/components@4.0.6
  - @object-ui/types@4.0.6
  - @object-ui/core@4.0.6
  - @object-ui/react@4.0.6

## 4.0.5

### Patch Changes

- 1dc6061: fix(build): inline dynamic imports in library outputs

  Library `vite build --lib` outputs were emitting separate code-split chunks
  (`rolldown-runtime-*.js`, `LookupField-*.js`, etc.) when source files used
  `React.lazy()` / dynamic `import()`. When consumer apps re-bundled these
  multi-file dists, the library's per-chunk rolldown-runtime collided with the
  consumer's own runtime, causing "TypeError: i is not a function" at runtime
  when lazy components tried to register themselves (e.g. TextField in
  `@object-ui/fields` after 4.0.4).

  Adding `output.inlineDynamicImports: true` to all `@object-ui/*` library vite
  configs forces a single `dist/index.js` per package, which lets consumer
  bundlers handle the library as an opaque ESM module without identifier
  mismatches across chunks.

  Affected packages: components, fields, layout, plugin-aggrid, plugin-ai,
  plugin-calendar, plugin-charts, plugin-chatbot, plugin-dashboard,
  plugin-designer, plugin-detail, plugin-editor, plugin-form, plugin-gantt,
  plugin-grid, plugin-kanban, plugin-list, plugin-map, plugin-markdown,
  plugin-report, plugin-timeline, plugin-view, plugin-workflow.

- Updated dependencies [1dc6061]
  - @object-ui/components@4.0.5
  - @object-ui/types@4.0.5
  - @object-ui/core@4.0.5
  - @object-ui/react@4.0.5

## 4.0.4

### Patch Changes

- d2b6ece: fix: externalize all bare imports in library builds

  Library builds (vite lib mode) now externalize every non-relative import instead of bundling third-party CJS dependencies into the published dist. This avoids inlined `require("react")` / `require("react-dom")` calls that cause `Calling \`require\` for "react" in an environment that doesn't expose the \`require\` function` runtime errors when consumer apps re-bundle the published dist.

  Specifically fixes:

  - `@object-ui/plugin-dashboard` no longer inlines `react-grid-layout` (and its transitive `react-draggable` / `react-resizable` CJS bundles). `react-grid-layout` is now declared as a peer dependency so consumers install a single ESM-friendly copy.
  - `@object-ui/components`, `@object-ui/plugin-calendar`, `@object-ui/plugin-charts`, `@object-ui/plugin-designer` no longer inline `react-i18next` / `i18next` / `use-sync-external-store` CJS shims.
  - All plugin packages now use a unified `external: (id) => !/^[./]/.test(id) && !id.startsWith(__dirname)` rule, ensuring future additions of CJS deps are automatically externalized.

- Updated dependencies [d2b6ece]
  - @object-ui/components@4.0.4
  - @object-ui/types@4.0.4
  - @object-ui/core@4.0.4
  - @object-ui/react@4.0.4

## 4.0.3

### Patch Changes

- 4be43e2: **Page-mode record forms (`editMode: 'page'`).** New per-object metadata flag that opts a record's create/edit form into a dedicated full-screen route (`/apps/:appName/:objectName/new`, `/apps/:appName/:objectName/record/:recordId/edit`). Two new declarative actions `navigate_create` and `navigate_edit` open these routes from JSON action buttons. Default modal behavior is preserved for objects that do not set `editMode`.

  **`@object-ui/plugin-list` & `@object-ui/plugin-detail`: `ComponentRegistry` singleton fix.** Both plugins' Vite configs now mark all `@object-ui/*` packages as external so each plugin no longer bundles its own private copy of `@object-ui/core`. Cross-plugin component lookups now resolve correctly from the same singleton registry. `plugin-list` dist shrank from multi-MB to 67 kB (gzip 16 kB); `plugin-detail` to 124 kB (gzip 28 kB).

  **`@object-ui/app-shell` `CreateViewDialog` churn fix.** `existingSet` is now memoised on the joined string key of `existingLabels` rather than the raw array reference, preventing the name-suggest `useEffect` from re-firing on every parent render.

  **CI fixes.** `ReportViewer` conditional-formatting test now accepts both `rgb(...)` and hex color representations. `ObjectView` i18n mocks rewritten to mirror the real hook shapes (`useObjectTranslation`, `useObjectLabel`).

- Updated dependencies [4be43e2]
  - @object-ui/types@4.0.3
  - @object-ui/core@4.0.3
  - @object-ui/react@4.0.3
  - @object-ui/components@4.0.3

## 4.0.1

### Patch Changes

- @object-ui/types@4.0.1
- @object-ui/core@4.0.1
- @object-ui/react@4.0.1
- @object-ui/components@4.0.1

## 4.0.0

### Patch Changes

- Updated dependencies
  - @object-ui/types@4.0.0
  - @object-ui/components@4.0.0
  - @object-ui/core@4.0.0
  - @object-ui/react@4.0.0

## 3.4.0

### Patch Changes

- Updated dependencies [a2d7023]
- Updated dependencies [f1ca238]
- Updated dependencies [de881ef]
  - @object-ui/components@3.4.0
  - @object-ui/types@3.4.0
  - @object-ui/core@3.4.0
  - @object-ui/react@3.4.0

## 3.3.2

### Patch Changes

- @object-ui/types@3.3.2
- @object-ui/core@3.3.2
- @object-ui/react@3.3.2
- @object-ui/components@3.3.2

## 3.3.1

### Patch Changes

- Updated dependencies [b429568]
  - @object-ui/components@3.3.1
  - @object-ui/types@3.3.1
  - @object-ui/core@3.3.1
  - @object-ui/react@3.3.1

## 3.3.0

### Patch Changes

- @object-ui/types@3.3.0
- @object-ui/core@3.3.0
- @object-ui/react@3.3.0
- @object-ui/components@3.3.0

## 3.2.0

### Patch Changes

- @object-ui/types@3.2.0
- @object-ui/core@3.2.0
- @object-ui/react@3.2.0
- @object-ui/components@3.2.0

## 3.1.5

### Patch Changes

- @object-ui/react@3.1.5
- @object-ui/components@3.1.5
- @object-ui/types@3.1.5
- @object-ui/core@3.1.5

## 3.1.4

### Patch Changes

- @object-ui/types@3.1.4
- @object-ui/core@3.1.4
- @object-ui/react@3.1.4
- @object-ui/components@3.1.4

## 3.1.3

### Patch Changes

- @object-ui/types@3.1.3
- @object-ui/core@3.1.3
- @object-ui/react@3.1.3
- @object-ui/components@3.1.3

## 3.1.2

### Patch Changes

- @object-ui/types@3.1.2
- @object-ui/core@3.1.2
- @object-ui/react@3.1.2
- @object-ui/components@3.1.2

## 3.1.1

### Patch Changes

- Updated dependencies
  - @object-ui/types@3.1.1
  - @object-ui/components@3.1.1
  - @object-ui/core@3.1.1
  - @object-ui/react@3.1.1

## 3.0.3

### Patch Changes

- @object-ui/types@3.0.3
- @object-ui/core@3.0.3
- @object-ui/react@3.0.3
- @object-ui/components@3.0.3

## 3.0.2

### Patch Changes

- @object-ui/types@3.0.2
- @object-ui/core@3.0.2
- @object-ui/react@3.0.2
- @object-ui/components@3.0.2

## 3.0.1

### Patch Changes

- Updated dependencies [adf2cc0]
  - @object-ui/react@3.0.1
  - @object-ui/components@3.0.1
  - @object-ui/types@3.0.1
  - @object-ui/core@3.0.1

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
  - @object-ui/core@3.0.0
  - @object-ui/react@3.0.0
  - @object-ui/components@3.0.0

## 2.0.0

### Major Changes

- b859617: Release v1.0.0 — unify all package versions to 1.0.0

### Patch Changes

- Updated dependencies [b859617]
  - @object-ui/types@2.0.0
  - @object-ui/core@2.0.0
  - @object-ui/react@2.0.0
  - @object-ui/components@2.0.0

## 0.3.1

### Patch Changes

- Maintenance release - Documentation and build improvements
- Updated dependencies
  - @object-ui/types@0.3.1
  - @object-ui/core@0.3.1
  - @object-ui/react@0.3.1
  - @object-ui/components@0.3.1
