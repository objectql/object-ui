---
'@object-ui/i18n': minor
'@object-ui/app-shell': minor
---

**The maker's edit-mode starter offers sample data, not an automation v1 cannot
build (objectui#7709).** Bound to an existing app (`?package=`), the maker's
empty state offered four starters: add a field, add an object, add a dashboard,
and 「加一个自动化 —— 审批、状态流转或通知」. Approval, status flow and
notification are all refused by ADR-0112 v1 (cloud#1956 / PR #1970), and the
measured behaviour on the sibling chips was not a refusal but a silent degrade
into a view — so the product recommended an automation and would have handed
back a page.

Rewording it was not available: asking for a field, a view or a dashboard
duplicates one of the three chips beside it. The fourth chip is now
`addSampleData` —「给现有对象补一批贴近真实的示例数据，好拿去演示。」 — in all
ten packs and in the call-site `defaultValue` fallback, which is a second copy
of the same string. The three surviving chips all add STRUCTURE; what an app
that already has objects most often lacks is DATA, and `seed` is on v1's
authoring whitelist. A note beside the keys in every pack and at the call site
says this chip's automation wording comes back when ADR-0112 v2 re-adds flows
and actions, and the retired sentence for each pack is kept in the guard suite
so v2 has it verbatim.
