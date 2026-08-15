---
'@object-ui/i18n': patch
---

Delete two dead i18n namespaces — `workflow.*` (58 keys) and `publicForm.demo.*` (36 keys) — from all ten locale packs.

940 translated strings (94 keys x 10 packs) with **no reader anywhere in the
repo**. Measured with `node scripts/check-i18n-dead-keys.mjs`, the reverse sweep
from objectui#4658: it subtracts the referenced key set (the AST walk that
`check-i18n-call-site-keys.mjs` already uses, plus plural suffixes, plus
`returnObjects` branches, plus every dynamic template head) from the pack key
set, then re-checks each survivor with a fixed-string grep over the whole repo.
`workflow.*` scored 54/58 CONFIRMED with the other 4 appearing only in two i18n
test fixtures — mentions, not consumers; `publicForm.demo.*` scored 36/36 with
zero textual footprint anywhere outside the packs.

`workflow.*` is a complete BPMN/workflow-designer vocabulary (`userTask`,
`serviceTask`, `parallelGateway`, `boundaryEvent`, `importBpmn`/`exportBpmn`,
`undo`/`redo`, …). Its one plausible consumer,
`packages/plugin-designer/src/ProcessDesigner.tsx`, hardcodes English
(`{ label: 'User Task', value: 'user-task' }`) and imports no translation hook
at all, while six sibling components in the same package do use one — the
vocabulary was never wired up. `publicForm.demo.*` is demo content (contact and
support form titles, field labels, industry/issue-type/priority options) for a
public-form showcase page that does not exist in this repo.

No behaviour changes: a key with no reader cannot be read. The `publicForm.*`
parent namespace and every other namespace are untouched.
