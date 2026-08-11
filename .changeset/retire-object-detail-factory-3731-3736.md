---
'@object-ui/console': patch
---

Retire the dormant bespoke object-detail page factory and its seven widgets

`buildObjectDetailPageSchema()` had zero callers. Its only consumer was the registry-driven `MetadataDetailPage`, deleted when the console moved onto the metadata-admin engine; the factory outlived it by months as code no route could reach. The seven widgets it fed — `object-detail-tabs`, `object-properties`, `object-field-designer`, `object-relationships`, `object-keys`, `object-data-experience`, `object-data-preview` — were still registered in `ComponentRegistry` at startup, so they were reachable in principle by any schema naming those types, and in practice by none: nothing in the repository produces one.

That unreachability is also why 60 lines of hardcoded Chinese UI copy sat in `objectDetailWidgets.tsx` and `ObjectDetailTabsWidget.tsx` against the English-only rule without any gate seeing them — the strings were bare literals, never `t()` keys, and all three i18n gates judge keys. Translating copy that no user can reach, on a surface with no future, was the more expensive of the two exits; the maintainer ruled REMOVE (objectui#3731 / #3736) and both cards close together.

Deleted: `schemas/objectDetailPageSchema.ts`, `components/schema/objectDetailWidgets.tsx`, `ObjectDetailTabsWidget.tsx`, `ObjectFieldDesignerWidget.tsx`, `registerObjectDetailWidgets.ts`, and the `main.tsx` registration import. No user-visible behaviour changes, because no route rendered any of it. The `skills/objectui/guides/console-development.md` chapter that positioned the factory as the bespoke-editor recipe now points at the live specimen (`PermissionMatrixEditPage`) instead, and the retired names are recorded in that guide's "Retired names" table.
