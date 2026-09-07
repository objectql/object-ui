---
---

Test-only: pin the OUT-of-window half of objectui#7745's precedence pair —
`formatDate(v, 'relative', { style: 'short' })` on a years-old date renders the
default absolute face, not the `options.style` face. No published behaviour
changes.
