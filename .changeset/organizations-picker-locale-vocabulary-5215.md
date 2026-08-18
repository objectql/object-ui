---
'@object-ui/i18n': patch
---

The `organizations.*` picker locale family (avatar menu / console picker —
`mine`, `title`, `heading`, `subtitle`, `searchPlaceholder`, `new`, `current`,
`emptyTitle`, `emptyDescription`, `noMatches`) is now internally consistent in
all eight non-en/zh packs (`ar`, `de`, `es`, `fr`, `ja`, `ko`, `pt`, `ru`).

`en` and `zh` were renamed from "organization" to "workspace" terminology in
full; the other eight packs only had `create` follow, leaving each pack mixing
both nouns in one dropdown (e.g. `de.ts` read `create: "Workspace erstellen"`
directly beside `mine: "Meine Organisationen"`). Since PR #4638 restored the
avatar menu's "My Workspaces" entry, both lines render two apart in the same
menu. Each pack now uses the workspace term its own `create` key already
committed to (`Arbeitsbereich`-style German phrasing → `Workspace`, French
`espace de travail`, Japanese `ワークスペース`, Korean `워크스페이스`, Spanish/
Portuguese `espacio de trabajo` / `workspace`, Russian `рабочее пространство`,
Arabic `مساحة عمل`), with grammatical agreement (gender, definiteness,
particles) adjusted per key.

The sibling `organization.*` (singular) namespace — organization
**management**, a deliberately distinct surface per the comment separating the
two blocks in `en.ts` — is untouched in every pack.
