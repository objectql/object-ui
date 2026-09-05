---
'@object-ui/i18n': minor
'@object-ui/core': minor
'@object-ui/app-shell': minor
'@object-ui/plugin-chatbot': minor
'@object-ui/plugin-dashboard': minor
'@object-ui/plugin-report': minor
'@object-ui/console': minor
---

Six user-visible fixes across the maker surface, the assistant rail and the
dataset captions.

**The maker's start chips now promise only what ADR-0112 v1 builds
(cloud#1984).** Two of the five asked for automation the first version has no
flows or actions for — the ticket chip said 「状态流转」, the inventory chip said
「低库存预警」 — and the measured behaviour was not a refusal but a silent
degrade: a status kanban and a low-stock view. The chip promised an alert and
delivered a page. All five are reworded in all ten packs (and in the call-site
`defaultValue` fallbacks, which are a second copy of the same strings) to ask
for objects, fields, views, pages, dashboards and sample data, keeping each a
real business scenario — the ticket chip now asks for a status field and a board
grouped by it, the inventory chip for a view that filters below the reorder
point. A note beside the keys says to revert when v2 re-adds flows.

**Five newer AI tools get their step labels (objectui#7481).** A zh conversation
read `✓ Get authoring rules 已完成` between 「读取元数据结构」 and 「列出对象」:
`get_authoring_rules` (cloud#1837), plus `load_tools`, `open_record`,
`test_flow` and `toggle_flow`, are registered by the cloud AI runtime but are
newer than the pinned spec's tool registry, so they had no `chatbot.tool.*`
entry in any pack and fell through to the English title-caser.

**The assistant rail follows the thread when you send (objectui#7480).** The
rail and the full-page maker are the same component; what differs is width. A
reply that still ends on screen in the wide column runs two or three times
taller in a ~360px rail, so `StickToBottom`'s lock is escaped by the time the
user types and the new bubble, the tool steps and the streaming answer all land
below the fold. Every send path now re-arms the lock — including the plan-card
"Build it" and 确认修改 approvals, whose own code comments already named this
miss. Message APPENDS deliberately do not, so a user reading back through the
thread mid-answer is never yanked to the bottom.

**Console toasts move off the assistant composer (objectui#7482).** 「客户更新
成功」 sat on the ChatDock composer's send button and stayed there. One defect,
two symptoms: `apps/console` pinned the toaster to `bottom-right` — an override
that predates ADR-0057 P3a — so a toast both covered the button and, because
sonner pauses a toast's dismiss timer while the pointer is inside the toaster
region, never got to run its 4s timer with a pointer resting on the composer
underneath. The override is gone; the console takes `ConsoleToaster`'s own
documented top-right anchor, and the 4s success duration is now pinned.

**Built-in aggregate captions follow the locale everywhere (objectui#7534).**
objectui#7258 taught `buildChartSeries()` to resolve a server-minted default
measure through the locale map, so a chart legend read `计数` while the table
beneath it, the KPI caption, the pivot header and the dataset preview still
printed the server's hard-coded English `Count`. `buildDatasetFieldHelpers()`
takes the same optional `builtinAggregateLabels`, resolving through the one
`resolveMeasureLabel` order, and the five call sites pass it. Omitting the
argument reproduces the previous output byte for byte, and an author-declared
measure still keeps its own label verbatim (objectui#4106).

**The activity feed stops asking for an object the environment does not have
(objectui#7476).** A tenant environment has no `sys_activity`, so every page
load issued a request that 404'd. Everything downstream was already correct —
the adapter memoizes the missing collection, its logger demotes the failure, the
feed retires as an ANSWER and the panel renders its earned empty state — so what
is left is the request itself, and `data-objectstack` states the rule for it:
the cure for a doomed request is not issuing it. New `useObjectPresence` reads
the object registry the shell loads for the nav anyway; only a registry that has
ANSWERED and lists other objects without this one skips the read. Every
uncertainty — no provider, empty registry, still loading, errored — reads as
before, because a wrong skip would cost a real deployment its feed.
