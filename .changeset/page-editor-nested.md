---
"@object-ui/app-shell": minor
---

The Studio page editor can now edit nested sub-blocks inside container blocks. A `page:tabs`/`page:accordion` tab's children, and a `page:card`/`page:section`'s body, are surfaced as indented, selectable sub-blocks — each one can be selected, configured (via the inspector and its object/field pickers), edited, removed, and new ones added — in both full and slotted pages. Addressing is handled by extending the block-path scheme to support object-key hops (e.g. `…components[0].properties.items[0].children[0]`) and a nested sub-path under slot ids. Closes the last gap so a container's contents are fully point-and-click instead of raw JSON.
