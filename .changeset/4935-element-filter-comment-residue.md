---
---

Comment-only cleanup in `@object-ui/components`: the `elements.tsx` header note no
longer lists `element:filter` among the heavier interactive elements said to live in
their owning plugins. No such file ever existed for it, and the element was retired at
element grain upstream (ADR-0049), so the type is gone from `PageComponentType`
entirely. No published behaviour changes.
