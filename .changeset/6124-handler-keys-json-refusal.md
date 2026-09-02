---
"@object-ui/types": minor
---

`@object-ui/types/zod`: the 58 `on*` handler keys declared `z.function()` now refuse BY NAME (objectui#6124)

The zod mirrors declared 58 `on*` keys (26 distinct — `onClick`, `onChange`, `onOpenChange`, `onValueChange`, `onCardMove`, …) across `complex`, `data-display`, `disclosure`, `feedback`, `form`, `layout`, `navigation` and `overlay` as `z.function()`, a declaration no JSON document can satisfy on a JSON-authored vocabulary. A JSON author who wrote `onClick: { "action": "toast" }` was already refused, with zod's bare `invalid_type … expected function, received object` naming the key and nothing else.

Every one of the 58 sites is now a named refusal arm in the shape #5099 landed for `FieldConstraintsSchema.pattern.value` (`z.custom` + guidance, via `handlerKeyRefusal()` in `zod/tombstone.zod.ts`): the message names the key, says why JSON cannot author it, and points at the node-type spelling PR #6498 established (`{ "type": "toast" }`, an `action:button` node with a declared action). The same text is the key's `.describe()` metadata — one string, two channels. Deleting the keys was measured and refused: under `BaseSchema.passthrough()` an undeclared key is not refused, it is KEPT, and `onClick` rides `SDUI_DOM_PASS_THROUGH_KEYS` into the DOM listener slot where React throws at click.

**Accept-set change (Clause ②).** A live function value — which parsed green before — is now refused on the JSON mirror too. The programmatic face reaches renderers through the TypeScript interface and React props, never through `safeParse`; on this tree the only runtime `safeParse` doors into these mirrors are the CLI validators and the exported `validateSchema` / `safeValidateSchema` helpers, none of which is fed a function-bearing object. Code that ran a host-supplied function through one of these mirrors must stop doing so.

**TypeScript face, measured per key.** 36 keys whose function value reaches a renderer at runtime (read off `schema.*`, called as a React prop after `SchemaRenderer`'s spread, or spread onto a Radix root / DOM listener slot) keep their function type. 22 keys nothing reads carry the `?: never` tombstone (ADR-0049): `KanbanSchema.onColumnAdd` / `onCardAdd`, `CarouselSchema.onSlideChange`, `ChatbotSchema.onSendMessage`, `AlertSchema.onDismiss`, `ListItem.onClick`, `TreeViewSchema.onSelectChange` / `onExpandChange`, `ToastSchema.onDismiss`, `RadioGroupSchema` / `SwitchSchema` / `ToggleSchema` / `SliderSchema` / `CalendarSchema` / `ComboboxSchema` / `CommandSchema` `.onChange`, `InputOTPSchema.onComplete`, `BreadcrumbItem.onClick`, `SidebarSchema.onCollapsedChange`, `ButtonGroupButton.onClick`, `AlertDialogSchema.onConfirm` / `onCancel`. Assigning one of those is now a `tsc` error naming the key.

Out of scope, per the ruling: the four non-`on*` `z.function()` keys (`cell`, `custom`, `validate`, `renderCellEditor`) stay as they are; `EventHandlersSchema` is objectui#6910's card.
