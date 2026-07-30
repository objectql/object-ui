---
"@object-ui/types": patch
"@object-ui/components": patch
"@object-ui/plugin-form": patch
---

fix(form): a tabbed/sectioned create-edit form no longer loses the tabs you are not looking at (#2959, #2153)

The explicit-`sections` path rendered one `SchemaRenderer` — one react-hook-form
instance and one `<form>` element — **per section**, all sharing the same
`formId`. Two failures compounded:

1. the footer submit button (`form={formId}`) can only be associated with the
   **first** of those forms, so section 2+ never reached the payload; and
2. in the `tabbed` variant Radix unmounted the inactive panel, destroying that
   tab's form state outright.

Reported flow (HotCRM, 3 tabs, required `description` on tab 3): fill tab 1 →
submit → server 400 `description is required` → switch to tab 3, fill it →
submit → the server now reports `subject; description; status; priority` **all**
missing, because the second submit's body had lost every earlier value.

`ModalForm` (stacked and `contentLayout: 'tabbed'`) and `TabbedForm` now render
ONE form for all sections, matching `ObjectForm` / `DrawerForm`. Stacked sections
use the existing inline `section-divider` header (which now also renders the
section's `description`); tabbed sections go through a new
`FormSchema.fieldTabs` (+ `defaultFieldTab`, `fieldTabsPosition`) that the form
renderer distributes into **force-mounted** Radix panels — CSS-hidden rather
than unmounted, since react-hook-form skips validation for unmounted fields,
which is how a required field on a tab nobody opened used to sail past the
client and come back as a server 400.

Validation feedback now points at the tab: a rejected field activates its tab and
every tab holding one is marked on its trigger, for client-side rules and server
`fields[]` rejections alike.
