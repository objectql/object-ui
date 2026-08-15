---
'@object-ui/components': patch
---

`page:accordion` now renders an item's `icon` in its panel trigger.

`PageAccordionItem` (`packages/components/src/renderers/layout/containers.tsx`)
has always declared `icon?: string`, but `PageAccordionRenderer` never read it
— an authored icon reached the trigger and was silently dropped. The
`objectstack` spec's `PageAccordionProps.items[].icon` already treats this as
legitimate, undeprecated authorable surface (unlike the neighboring `value`
key, which the same schema explicitly flags as dead), so the renderer was the
side out of sync. It now renders the Lucide icon before the panel label,
following the same convention `page:tabs` items already use in this file.
