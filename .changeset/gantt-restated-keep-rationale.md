---
---

Comment-only change in `@object-ui/plugin-gantt`: no published behaviour, no
declaration and no type changes. `GanttConfigRestated`'s docblock in
`ObjectGantt.tsx` said its members are kept for ONE reason — their JSDoc being
the only prose in this repo for what the renderer does with each key. Measured
on `main` that was false in two ways: four of the twelve members carry no JSDoc
there (`parentField`, `baselineEndField`, `assigneeField`, `effortField`), and
`ObjectGanttSchema` in `@object-ui/types` has documented all twelve since
objectui#6472. The docblock now states both keep-reasons — the prose, and being
an operand of `ObjectGantt.configPin.test.ts` — so the deletability test a
reader applies to `parentField` arrives at "keep".
