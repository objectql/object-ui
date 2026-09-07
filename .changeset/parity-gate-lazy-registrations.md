---
---

Test-only change to the console's registry/spec parity gate (`apps/console/src/__tests__/registry-inputs-spec-parity.test.ts`): it now loads the two spec-carried plugin blocks the console registers lazily, and asserts its own coverage so a block can no longer fall out of the judged population silently. Also adds one member pin next to the renderer it constrains (`packages/plugin-kanban/src/__tests__/ObjectKanban.filterMembersReachTheWire-8176.test.tsx`), so the `filter` key objectui#8186 declared is answered with a pin rather than with an exemption. No published behaviour changes — no renderer, registration or runtime file is touched.
