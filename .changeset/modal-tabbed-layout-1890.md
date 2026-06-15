---
"@object-ui/plugin-form": patch
---

feat(form): modal forms can host a tabbed layout (modal + tabbed composes)

`ModalForm` rendered sections as a flat vertical stack — a modal create/edit
form could never be tabbed, because `formType` (one field) couldn't be both
`modal` (container) and `tabbed` (layout). Per ADR-0050 (additive first), the
modal container now accepts a `contentLayout` ('simple' | 'tabbed'): when
`tabbed`, sections render as tabs inside the dialog. The console record
New/Edit modal (`AppContent`) forwards the default form view's layout, so a
`type:'tabbed'` form view now renders tabbed in the modal too — not just on the
full-page route (#1762). Non-breaking; `FormView.type` enum unchanged.

Refs objectstack-ai/framework#1890, ADR-0050
