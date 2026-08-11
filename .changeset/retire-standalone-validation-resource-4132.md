---
'@object-ui/app-shell': patch
---

metadata-admin: retire the standalone `validation` resource, and move
`ValidationPreview` onto the embedded path the framework actually evaluates
(objectui#4132)

`anchors.ts` registered a standalone `validation` resource anchored by
`anchorByField('object')`, complete with `createFields` / `createSchema` /
`createDefaults`. That gave every object's Related tab a "Validations" group
whose `+` routed to `validation/_new`, and the file justified it in a comment:
"usually embedded in the object, but standalone variants do exist."

They do not. ADR-0088 / objectstack#4509 retired `validation` as a metadata
kind, and the framework ledger (`packages/spec/liveness/validation.json`)
records that the door never led anywhere in the first place:

> a STANDALONE `validation` item (file `*.validation.ts` or Studio) never
> reached any object's write path, because the schema has no object-binding key
> and — every variant being `.strict()` — an author could not add one; no merge
> code existed […] A state machine authored through that door saved cleanly and
> gated nothing.

Re-measured against the installed `@objectstack/spec` 17.0.0-rc.6 by parsing the
shipped registries rather than grepping source: `validation` is in neither
`DEFAULT_METADATA_TYPE_REGISTRY` (27 kinds) nor
`listUnregisteredKindSchemaTypes()` (`connector`, `sharing_rule`, `webhook`). So
the console was offering an authoring affordance for a kind the framework does
not have — the "shipped false signpost" shape, where the most confident surface
in the product is the one for the thing that does not work.

**What is gone**: the standalone registration, its create affordance, and the
stale comment. **What stays**: the embedded anchor `__object_validation`
(`editAs: 'validation'`, `embeddedPath: 'validations'`) — rules live inside their
object, and that is the path the framework evaluates.

**The renderer moved rather than retiring with the door.** `ValidationPreview`
renders a rule's label, description, severity/message callout, per-variant body
and tags, and until now the only route that mounted it was `ResourceEditPage`'s
Preview tab on the retired standalone resource; the governed route (Related tab
→ `MetadataDetailDrawer` → `EmbeddedItemEditor`) drew a bare `SchemaForm`.
`EmbeddedItemEditor` now looks a preview up by the anchor's `editAs` and mounts
it above the form on the live draft. The lookup is generic, so this is not a
`validation` special case: an embedded sub-type with no registered preview
(`index`) is unchanged and grows no empty preview chrome. This also re-opens
objectstack#7427's `validation.label` / `.description` / `.tags` ledger rows,
which were graded `dead` precisely because the render was unreachable on the
evaluated path.

**One read went with the door.** `ValidationPreview` painted an
`object: <name>` pill, exempted from the objectui#3275 cleanup on the stated
ground that "anchors.ts registers a standalone `validation` resource … so a
standalone rule really does carry it". With that registration gone the read has
no producer, and it never had one on the governed path either — measured,
`ValidationRuleSchema.safeParse({ type: 'script', …, object: 'account' })`
returns `unrecognized_keys: ['object']`. The pill could only ever confirm a key
that makes the rule unsaveable. Its test case is replaced rather than re-spelled:
the schema's verdict is now the instrument, and the preview is asserted not to
paint the key.
