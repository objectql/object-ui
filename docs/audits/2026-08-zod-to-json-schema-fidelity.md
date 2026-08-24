# Audit: zod to JSON Schema conversion fidelity for `@object-ui/types` (2026-08)

**Card**: objectui#5392 — the measurement the 2026-08-22 ruling required before the
A / B / C fork on shipping a generated JSON Schema is decided.
**Measured on**: `origin/main` @ `17fbbafbb`, **without** objectui#6117 (see
[Base](#base-and-the-6117-delta)).
**Status**: ⛔ This is a measurement. No generator, no drift gate and no published
artifact are proposed or added by it. The fork stays open.

---

## Summary

| Question | Answer |
| --- | --- |
| Converter | `z.toJSONSchema()`, built in to **zod 4.4.3** — already a dependency, no new one needed |
| Population | `AnyComponentSchema` — 14 union members expanding to **106 leaf node schemas** |
| Converts under **default** options | **0 / 106** — every node type throws |
| Converts under **lenient** options | **106 / 106** |
| Faithful (nothing lost) | **0 / 106** |
| Degraded | **106 / 106** |
| Artifact size | **666,321 bytes** pretty · 376,928 minified · 56,621 gzipped |
| Added to the published package | **+21.8 %** of `dist` pretty, **+12.3 %** minified |
| Is the artifact closed? | **No.** 285 of 342 objects are open; `.strict()` is called **0** times in the mirrors |
| Is it stricter than zod anywhere? | **No — 0 / 475** corpus files. It is a strict *relaxation* |
| Would #5127's skipped files gain judgement? | **Partly, and not because of the artifact** — see [Q3](#q3-the-5127-judgement-surface) |

**The headline.** The generated artifact is a **strict relaxation** of the zod
source: over the repo's 475 root-`type` JSON files it agrees with
`AnyComponentSchema.safeParse` on 461 (97.1 %), is **weaker** on 14, and is
**stricter on none**. Every judgement it can deliver, `safeValidateSchema` already
delivers today — and delivers better. What shipping it would add is a 377–666 KB
published document, a generator, a drift gate, and a contract that *reads* closed
(`properties`, `required`, `const` on `type`) while carrying
`additionalProperties: {}` on all 106 node types and having silently discarded every
cross-field predicate in the source.

---

## The converter

```
zod version : 4.4.3          (packages/types dependency "zod": "^4.4.3")
entry point : z.toJSONSchema(schema, options)
dialect     : https://json-schema.org/draft/2020-12/schema
```

Fidelity is a property of a specific converter, so it is named: this is **zod's own
built-in**, not a third-party library. It is the right choice here because it needs no
new dependency — the package that would ship the artifact already depends on the
converter as the source of the mirrors.

The repo does carry `zod-to-json-schema@3.25.2` in `pnpm-lock.yaml`, but it is a
transitive dependency pinned to `zod@3.25.76`. It cannot convert these zod-4 shapes and
is not a candidate.

Two option sets are used throughout, and the distinction carries most of the result:

| leg | options | meaning |
| --- | --- | --- |
| **strict** | defaults | zod **throws** on anything it cannot represent |
| **lenient** | `{ unrepresentable: 'any', cycles: 'ref', reused: 'ref', io: 'input' }` | zod emits `{}` instead of throwing |

A real generator must use the lenient leg — the strict leg converts nothing. **Choosing
to generate is choosing to opt in to silent lossiness**, and that is a property of this
vocabulary, not of the converter.

## How the population was chosen

The barrel `@object-ui/types/zod` exports **199** zod symbols. That is the wrong
population: most are sub-shapes (`CRUDPagination`, `DetailViewTab`, `FilterUI`) that an
author never writes at a node position.

The population measured is **`AnyComponentSchema`** — the union that
`validateSchema()` / `safeValidateSchema()` parse, and therefore exactly the contract a
generated artifact would describe. Its 14 union members expand recursively to **106 leaf
node schemas**, which is the set of `type:` values an author can write:

> AccordionSchema, ActionSchema, AlertDialogSchema, AlertSchema, AppComponentSchema, AspectRatioSchema, AvatarSchema, BadgeSchema, BlockEditorSchema, BlockInstanceSchema, BlockLibrarySchema, BlockSchema, ButtonGroupSchema, ButtonSchema, CalendarSchema, CalendarViewSchema, CardSchema, CarouselSchema, ChartSchema, ChatbotSchema, CheckboxSchema, CollapsibleSchema, ComboboxSchema, CommandSchema, ComponentSchema, ContainerSchema, ContextMenuSchema, CRUDDialogSchema, CRUDSchema, DashboardComponentSchema, DataTableSchema, DatePickerSchema, DetailSchema, DetailViewSchema, DialogSchema, DivSchema, DrawerSchema, DropdownMenuSchema, EmptySchema, FileUploadSchema, FilterBuilderSchema, FilterUISchema, FlexSchema, FormSchema, GridSchema, HeaderBarSchema, HoverCardSchema, HtmlSchema, IconSchema, ImageSchema, InputOTPSchema, InputSchema, KanbanSchema, KbdSchema, LabelSchema, ListSchema, ListViewSchema, LoadingSchema, MarkdownSchema, MenubarSchema, NavigationMenuSchema, ObjectCalendarSchema, ObjectChartSchema, ObjectFormSchema, ObjectGanttSchema, ObjectGridSchema, ObjectKanbanSchema, ObjectMapSchema, ObjectViewSchema, PageNodeSchema, PaginationSchema, PopoverSchema, ProgressSchema, RadioGroupSchema, ReportBuilderSchema, ReportComponentSchema, ReportViewerSchema, ResizableSchema, ScrollAreaSchema, SelectSchema, SeparatorSchema, SheetSchema, SidebarSchema, SkeletonSchema, SliderSchema, SonnerSchema, SortUISchema, SpinnerSchema, StackSchema, StatisticSchema, SwitchSchema, TableSchema, TabsSchema, TextareaSchema, TextSchema, TextSpanSchema, TimelineSchema, ToasterSchema, ToastSchema, ToggleGroupSchema, ToggleSchema, TooltipSchema, TreeViewSchema, ViewSwitcherSchema

Two members resolve to unnamed inline shapes and are reported by their union position.

---

## Q1: fidelity

### The census

| result | count |
| --- | --- |
| converts under **default (strict)** options | **0 / 106** |
| converts under **lenient** options | **106 / 106** |
| **faithful** — converted with nothing lost | **0 / 106** |
| **degraded** — converted, constraint lost | **106 / 106** |
| **failed** — cannot convert at all | 0 / 106 (lenient) · 106 / 106 (strict) |

The strict leg fails on every single node type, all with the same first cause:

```
AccordionSchema: THREW: Undefined cannot be represented in JSON Schema
```

`z.undefined()` is an arm of `SchemaNodeSchema`'s union (`base.zod.ts:51-59`), which
`BaseSchema.body` / `.children` reference — so it is reachable from every node.

### What is actually lost, and it is not what was predicted

The card's named risk was `lazySchema` / refine / effects converting to `{}`. Measured
per construct:

| construct | sites | strict leg | lenient leg | verdict |
| --- | --- | --- | --- | --- |
| `z.lazy(` | 13 | converts | converts | ✅ **faithful — risk falsified** |
| `.refine(` | 2 | converts | converts | ⚠️ **predicate silently dropped** |
| `.superRefine(` | 3 | converts | converts | ⚠️ **predicate silently dropped** |
| `.transform(` | 0 | — | — | not present |
| `z.function(` | 60 | throws | `{}` | ❌ **accepts anything** |
| `z.undefined(` | 1 | throws | `{}` | ❌ blocks the whole strict leg |
| `z.any(` | 74 | `{}` | `{}` | ❌ accepts anything |
| `z.unknown(` | 10 | `{}` | `{}` | ❌ accepts anything |
| `z.custom(` | 0 | — | — | not present |
| `.passthrough(` | 5 real calls | `additionalProperties: {}` | same | ❌ **opens the object** |
| `.strict(` | **0 real calls** | — | — | nothing closes anything |

`z.lazy` converting cleanly is a genuine and useful negative result — recursion was the
loudest predicted risk and it is not a risk here.

**The dangerous one is `.refine` / `.superRefine`.** They neither throw nor emit `{}`.
They convert to a structurally complete, healthy-looking object with the predicate simply
**gone**. Isolated with controls that pass:

```
base.zod.ts:272  ComponentInputSchema "arms must be distinct"
   CONTROL  (predicate satisfied) zod=accept jsonschema=accept   control OK
   PROBE    (predicate violated)  zod=REJECT jsonschema=accept   <== PREDICATE SILENTLY DROPPED

app.zod.ts:99    NavigationItemSchema "`label` is required"
   CONTROL  (predicate satisfied) zod=accept jsonschema=accept   control OK
   PROBE    (predicate violated)  zod=REJECT jsonschema=accept   <== PREDICATE SILENTLY DROPPED
```

All five predicates in the mirrors, and what each stops being enforced:

| site | what it guards |
| --- | --- |
| `base.zod.ts:272` | `ComponentInput.type` union arms must be distinct |
| `app.zod.ts:99` | `id` and `label` required on every non-separator navigation item |
| `complex.zod.ts:481` | dashboard filter shape, delegated to a nested parse |
| `form.zod.ts:596` | field-widget namespace must be resolvable (`UNRESOLVABLE_FIELD_WIDGET_NAMESPACE`) |
| `objectql.zod.ts:258` | `tab requires a name` (`name` or `id` must be present) |

2 of the 5 were isolated with passing controls; the other 3 are reported as sites, not as
measured drops. See [what this cannot see](#what-this-measurement-cannot-see).

### The degraded shapes, named

**All 106 are degraded, and for the same reason: openness.** Every one descends from
`BaseSchema`, which is `.passthrough()` (`base.zod.ts:197`), so every one projects with
`additionalProperties` set to an accept-anything schema.

Across the whole artifact: **285 of 342 objects are open**, and only **9 of 4,046
properties** are vacuous `{}`. So the loss is overwhelmingly *openness*, not empty
property projections — the opposite of what the card's phrasing anticipated.

The 9 vacuous properties, named in full:

| shape | vacuous property |
| --- | --- |
| `DashboardComponentSchema` | `filter` |
| `DataTableSchema` | `visibleWhen`, `disabledWhen` (on two nested column shapes — 4 total) |
| `FilterBuilderSchema` | `items/value` |
| `FilterUISchema` | `items/value` |
| `ListViewSchema` | `items/anyOf/0/value` |
| `PageNodeSchema` | `properties/default` |

---

## Q2: size

Not estimated — generated and measured.

| | bytes |
| --- | --- |
| artifact, pretty (2-space) | **666,321** |
| artifact, minified | **376,928** |
| artifact, gzipped (minified) | **56,621** |
| `packages/types/dist` (the published payload) | 3,063,033 |
| — of which `.d.ts` | 2,759,737 |
| — of which `.js` | 303,296 |
| `packages/vscode-extension/schemas/objectui-schema.json` (today's stub) | 2,723 |

`@object-ui/types` publishes `files: ["dist", "README.md", "CHANGELOG.md", "LICENSE"]`.
Adding the artifact to `dist` grows the published payload by **+21.8 %** (pretty) or
**+12.3 %** (minified). It would be, by a wide margin, the largest single file in the
package — 2.2× the size of all the emitted JavaScript combined.

For scale, the artifact is **245×** the size of the vscode stub it would replace, which
is the card's own point that 2,723 bytes cannot be describing this vocabulary.

---

## Q3: the #5127 judgement surface

The card flags this as *"inference, not measurement"*. Measured.

### The corpus split, reproduced

Applying `check.ts`'s own `OBJECTUI_STRUCTURAL_KEYS` rule to every `.json` file in the
repo (excluding `node_modules`, `dist`, `.git`):

```
.json files scanned              : 620
files with a root string "type"  : 475
  JUDGED  (carry a structural key): 166
  SKIPPED (no structural key)     : 309   = 65.1 %
```

The card cites 258 files / 60.8 % on an earlier base. Of the 309 skipped here, **45 are
`package.json`** (`"type": "module"`); 309 − 45 = **264**, adjacent to 258 on a tree that
has moved four days. The populations agree.

### Would a generated artifact give them a judgement surface?

The only route is to use the artifact as the **recogniser** — judge a file when it
validates. Measured over the 309 skipped files:

| | artifact | `safeValidateSchema` (today, no new artifact) |
| --- | --- | --- |
| skipped files accepted | **223** | **209** |
| skipped files rejected | 86 | 100 |
| `package.json` files correctly refused | **45 / 45** | **45 / 45** |
| false accepts (zod rejects, it accepts) | **14** | 0 |

So the honest answer is:

1. **Yes, ~209 of the 309 files can be brought back into judgement** — that is a real
   answer to #5127's recall debt, and it is worth having.
2. **No, the generated artifact is not what delivers it.** `safeValidateSchema` delivers
   the same thing today, refuses the same 45 `package.json` files, and additionally
   refuses the 14 that the artifact wrongly accepts. The artifact is strictly the worse
   recogniser of the two.
3. Neither recogniser re-creates #5127's original defect — the `package.json`
   false-positive class stays at zero, because `type: "module"` matches no `const` in the
   union.

**The caveat that matters**, and it applies to both: a validity-based recogniser
conflates *"this file is foreign"* with *"this file is a broken ObjectUI schema"*. 41 real
schema files in the skipped set fail validation today (plus the 14 above = **55**), and a
recogniser would file them all under "not ObjectUI" rather than reporting them as invalid.
That is a design question for #6075, not a blocker — but it is not free.

### Full-corpus agreement

Over all 475 root-`type` files:

```
zod and artifact AGREE : 461/475  (97.1%)
artifact ACCEPTS where zod REJECTS (WEAKER)  : 14
artifact REJECTS where zod ACCEPTS (STRICTER): 0
```

**Zero cases where the artifact is stricter.** Lossy conversion can only widen, and it
did: the artifact is a strict relaxation of the source.

The 14 are all the same defect — `z.function()` projecting to `{}`. Example:

```json
{"type":"button","label":"Destructive Toast","variant":"destructive",
 "onClick":{"action":"toast","variant":"destructive","title":"Error", "...":"..."}}
```

```
zod      : REJECT — { code: "invalid_type", expected: "function", path: ["onClick"] }
artifact : accept
```

That those files exist at all is a separate defect, filed as **objectui#6124**: 28 mirror
keys are declared `z.function()`, which no JSON document can satisfy, and 14 corpus files
author them.

---

## The `[key: string]: any` projection — what it does to closedness

This is the trap the card named as decisive, and it is confirmed as a **first-class
result**, not a footnote.

`BaseSchema` ends `.passthrough()` (`base.zod.ts:197`, comment: *"Allow additional
properties for type-specific extensions"*). Projected:

```
z.object (closed)          -> additionalProperties = false
z.object().passthrough()   -> additionalProperties = {}      <- accepts anything
z.looseObject              -> additionalProperties = {}
```

Every one of the 106 node types extends `BaseSchema`, so every one inherits it. In the
mirrors, `.strict()` is called **zero** times — the three grep hits are all prose in
comments. Nothing anywhere closes a node.

Isolated on `ButtonSchema`:

| input | zod | artifact |
| --- | --- | --- |
| `{type:'button', label:'x'}` | accept | accept |
| `+ thisKeyIsNotDeclaredAnywhere: {...}` | accept | accept |
| `+ classNmae: 'p-4'` (misspelling of `className`) | accept | accept |

**A misspelled real key is accepted by both.** This is the exact AI-authoring failure the
card's axis ③ is about: an agent that writes `classNmae` gets a green light from the
schema, and the styling silently never applies.

⇒ **The card's stated hypothesis is confirmed: a generated JSON Schema buys no rejection
that `.strict()` has not already bought — and `.strict()` has bought none.** The artifact
would carry `properties`, `required`, and a `const` on every `type`, which *reads* as a
closed contract, while accepting arbitrary undeclared keys on all 106 node types. That is
the "looks closed and is not" hazard, measured rather than predicted.

The one thing the artifact does close: an **unknown `type` value** is refused, because
each leaf carries `{"type":"string","const":"button"}`. But `AnyComponentSchema` refuses
it too, so this is not a gain over today either.

---

## What the measurement points to

⛔ The fork is the maintainer's. What the numbers support:

### A — ship a generated JSON Schema from `@object-ui/types`: **not supported today**

Against it, all measured:

- It is a **strict relaxation** of the zod source (0/475 stricter, 14/475 weaker). It adds
  no rejection anywhere.
- It costs **+12–22 %** of the published package, plus a permanent generator, a drift gate
  and a build slot.
- It publishes a **second description** of the contract into the #4972 / #4605 family,
  and this one is guaranteed to disagree with the first — the divergence is not a risk,
  it is measured at 14 files.
- It hands AI authors a document that reads closed and is open on every node type.

The honest form of this result is the one the dispatch anticipated: **A is not worth
having until #5155 moves.** If `BaseSchema` were closed, the artifact would project
`additionalProperties: false` and the calculation changes completely — the 5 dropped
predicates would then be the only remaining gap, and 5 predicates over 106 node types is
a defensible loss. The blocker is the source's permissiveness, not the converter.

### B — do not ship; keep zod source + `objectui check`: **what the numbers support**

`safeValidateSchema` already delivers everything the artifact would, strictly better
(97.1 % agreement, never worse, better on 14). It is version-correct by construction,
costs zero bytes, and cannot drift from itself.

There is a concrete, zero-cost improvement available inside B, and it does not need this
card's artifact: **#6075's recall debt can be repaid by using `safeValidateSchema` as the
recogniser**, which admits ~209 of the 309 skipped files and refuses all 45
`package.json`. That would unblock #6075 from #5392 entirely. (Subject to the
foreign-vs-invalid caveat above — that is #6075's design question to answer.)

### C — vscode-extension-only: **defensible, on an axis this measurement does not damage**

Worth stating precisely, because it is easy to read the fidelity numbers as killing C too,
and they do not. **C's value is completion, not rejection.** An editor offering key names,
enum arms and `description` hover text needs *suggestions*, and every degradation measured
here — openness, dropped predicates, `{}` handlers — leaves suggestions intact. The 2,723-byte
stub covers essentially none of a ~200-type vocabulary; a 377 KB generated document would
cover it. C also carries no publish obligation, so the drift gate is cheaper and a stale
artifact misleads an editor rather than a contract.

C's cost is that it is a generated artifact all the same, and the axis ③ hazard partly
survives: an editor that accepts `classNmae` without complaint still teaches the wrong
thing. It just teaches it to a human in an editor rather than to an agent reading a
published contract.

---

## What this measurement cannot see

Stated because the card's own confidence gap is the model for this section.

1. **It measures the zod mirrors, not the contract.** The mirrors are one of two
   descriptions; the TypeScript interfaces are the other, and they are *already known to
   disagree* on 17 keys (#5927), plus #5853 and #6058 in the opposite direction. A
   generated artifact would inherit the **mirror's** view of the contract, including
   every one of those disagreements. This audit did not adjudicate any of them.
2. **3 of the 5 predicates were not isolated.** `complex.zod.ts:481`,
   `form.zod.ts:596` and `objectql.zod.ts:258` are reported as sites; only the 2 with
   passing controls are reported as measured drops. The mechanism is the same and they
   are very likely dropped too, but that is inference.
3. **In-repo corpus only.** 475 files in this repository. What consumers author against
   published `@object-ui/types` on npm is invisible, and the corpus here is heavily
   weighted toward `examples/schema-catalog`.
4. **One validator.** Accept/reject was measured with **ajv 8.20.0** in draft-2020-12
   mode with `strict: false`. VS Code's own JSON Schema engine, and other validators,
   differ on `$ref`/`$defs` cycle handling and on `anyOf` error reporting — a document
   this recursive is exactly where they differ most.
5. **Completion quality is asserted, not measured.** The C recommendation rests on
   suggestions surviving the losses, which is structural reasoning. Nobody drove an
   editor against the artifact. The `description` strings survive into the output, but
   whether they are *good enough to author from* was not assessed.
6. **Runtime is out of frame.** The renderer may accept or reject things that neither
   zod nor the artifact do. Validation agreement is not rendering agreement.
7. **`io: 'input'` only.** The lenient leg converts the input side. A generator might
   reasonably want the output side, which differs wherever defaults or coercion appear.

## Base, and the #6117 delta

Measured on `origin/main` @ **`17fbbafbb`**. objectui#6117 (retire `CRUDSchema` and the
`crud` node type) was **open and unmerged** at measurement time — head
`claude/issue-5373-retire-crud-schema` @ `ec71e390d` — so the census includes
`CRUDSchema`. Rather than block, the delta was measured directly by removing
`CRUDComponentSchema` from the union:

```
union members            : 14  ->  13
leaf node schemas        : 106 ->  105
artifact pretty (bytes)  : 666,321 -> 630,554   (delta -35,767)
```

`CRUDDialogSchema`, `DetailSchema` and `ActionSchema` stay in the union. #6117 moves the
census by exactly one node type and ~36 KB — about 5 % of the artifact — and **no
conclusion in this audit depends on it**: the fidelity ratios (0/106 faithful, 0 stricter,
all nodes open) are properties of `BaseSchema`, which #6117 does not touch.

## Reproducing

The measurement script is deliberately **not committed** — it is a throwaway instrument,
not a generator, and committing it would be the thing this card is not ruled to do. Every
number above is reproducible from these commands.

```bash
# build first — a stale dist/*.d.ts lies in both directions
pnpm --filter @object-ui/types build

# converter identity
node -p "require('./packages/types/node_modules/zod/package.json').version"   # 4.4.3

# construct census — use grep -F; an unescaped '(' in an ERE silently matches nothing
cd packages/types/src/zod
grep -oF 'z.function(' *.ts | wc -l          # 60
grep -oF '.superRefine(' *.ts | wc -l        # 3
grep -oF '.refine(' *.ts | wc -l             # 2
grep -oF 'z.lazy(' *.ts | wc -l              # 13
grep -oF '.passthrough(' *.ts | wc -l        # 14 hits, 5 real calls
grep -oF '.strict(' *.ts | wc -l             # 3 hits, 0 real calls
grep -oF 'z.string(' *.ts | wc -l            # 710 — positive control
grep -oF 'z.bigint(' *.ts | wc -l            # 0   — negative control

# conversion, size, corpus agreement
#   z.toJSONSchema(AnyComponentSchema, { unrepresentable:'any', cycles:'ref',
#                                        reused:'ref', io:'input' })
#   validated with ajv 8.20.0 (dist/2020.js), strict:false
```

### A note on the instrument

The first construct census returned **0 for every parenthesised pattern**, including
`z.lazy(`, which `base.zod.ts:51` visibly contains. The cause was an unescaped `(` in
`grep -oE`, opening an unterminated group; `2>/dev/null` hid the error and the zeros read
as findings.

It was caught by the control: the same run's escaped `z\.string\(` returned 710 while
`z.object(` returned 0, which cannot both be true. Every count above is from `grep -oF`
with stderr visible, and every zero sits in a table beside a non-zero produced by the
identical instrument.

This is recorded rather than quietly fixed because it is the failure mode this card was
explicitly warned about, and it fired on the first attempt.
