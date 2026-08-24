---
---

Docs only, publishes nothing: five `content/docs/components` reference pages
annotated an event prop as `string | ActionConfig` — a type `@object-ui/types`
has never exported. Each site was resolved individually against the freshly
built `packages/types/dist/*.d.ts`, and in every case the shipped slot is a
plain function callback that the page had also named wrongly:

| page | documented | shipped slot | declaration |
| --- | --- | --- | --- |
| `form/command.mdx` | `onSelect` | `onChange?: (value: string) => void` | `form.d.ts:1376` |
| `form/radio-group.mdx` | `onValueChange` | `onChange?: (value: string \| number) => void` | `form.d.ts:394` |
| `form/date-picker.mdx` | `onDateChange` | `onChange?: (date: Date \| undefined) => void` | `form.d.ts:642` |
| `form/combobox.mdx` | `onValueChange` | `onChange?: (value: string) => void` | `form.d.ts:1324` |
| `feedback/toast.mdx` | `actionLabel` + `onAction` | `action?: { label: string; onClick: () => void }` | `feedback.d.ts:137` |

The `string |` half of each annotation goes with the name, and that is the
substance rather than a tidy-up: objectui#4453 narrowed the runtime to
`typeof === 'function'`, so an authored string handler is **dropped**
(`packages/plugin-calendar/src/calendar-view-renderer.tsx`). A reference page
promising `string | Fn` is exactly what makes an AI author emit a handler that
publishes, validates, and silently does nothing.

No type was minted to make the prose true. Measured with a throwaway re-fence
probe: `TS2304: Cannot find name 'ActionConfig'` **10 → 5** across the
`components` group, and the 5 that remain are objectui#6132's, untouched here.

Part of objectui#6122.
