---
"@object-ui/app-shell": minor
---

feat(studio): expand loop / parallel / try_catch regions inline on the flow designer canvas (#2670)

The flow designer rendered ADR-0031 structured control-flow containers
(`loop` / `parallel` / `try_catch`) as opaque single node cards — their nested
regions (`config.body` / `config.branches[]` / `config.try`/`catch`) were only
visible, and only editable, as raw JSON in the inspector's Advanced block.

A container card now carries an expand chevron that grows the card **in place**
to embed its region(s) as a read-only mini-canvas — the same top-to-bottom
node/edge layout as the parent graph, scaled to fit the card width — with a
header per region (a named branch or `Branch N`, and `Try` / `Catch`; a loop
body has none). The canvas layout is geometry-aware: the layers below an
expanded container are **pushed down** by its real height and its outgoing edge
leaves from its true bottom. Collapsed by default; expansion is session-only
view state (never written to the flow draft). Legacy flat loops (a `loop` with
no `config.body`) and all ordinary nodes render exactly as before — with no
expanded container the layout is identical to the previous release, locked by
invariance tests.

Known limitation: a node pinned via a manual drag position sitting at/below an
expanded container can overlap it (manual positions are absolute); drag it
clear or collapse the container.
