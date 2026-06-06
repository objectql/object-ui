---
"@object-ui/app-shell": minor
---

The Studio page editor can now edit slotted record pages. A `kind:'slotted'` page surfaces its 7 canonical slots (header / actions / alerts / highlights / details / tabs / discussion) as editable regions — overridden slots show their blocks (selectable + configurable via the inspector and its object/field pickers), and unoverridden slots show an "inherited — add a block to override" placeholder. Edits write back to `slots`; empty slots are omitted so they keep inheriting the synthesized default. This closes the loop for the most common low-code task — customizing a business object's detail page (highlights/tabs/details) point-and-click instead of by hand-editing JSON.
