---
"@object-ui/app-shell": patch
"@object-ui/i18n": patch
---

fix(app-shell,i18n): record forms no longer render the developer-voiced default subtitle

Every create/edit record form (both the console dialog in `AppContent` and the
full-page `RecordFormPage`) hardcoded a platform default description under the
title: "Add a new {{object}} to your database." / "Update details for
{{object}}" (zh: 「向数据库添加新的{{object}}。」/「更新{{object}}的详情」).

The copy is developer-tooling voice leaking into end-user business apps — a
scheduling clerk filling in a 排班计划 has no business being told about "the
database", and the phrasing came straight from admin-panel boilerplate. The
line carried no information the form title didn't already have, and neither
call site let a form view override it.

The default subtitle is now gone: both call sites stop passing `description`,
and the unused `form.createDescription` / `form.editDescription` keys are
removed from all ten locale bundles (the `workspace.createDescription` key is
unrelated and stays).
