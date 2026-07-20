---
"@object-ui/app-shell": minor
"@object-ui/fields": patch
---

feat(action-params): serialize file/image action params to storage id(s); retire the approvals composer

Declared action params of `type: 'file'`/`'image'` now POST the portable API
contract — the storage id(s) — instead of the upload widget's rich object:

- `FileField` surfaces the id it already receives from the upload adapter
  (`meta.fileId`) as `file_id` on each emitted file object (additive; the
  record file-field value shape is unchanged).
- `ActionParamDialog` maps upload-param values to their `file_id`(s) at submit
  (`serializeParamValues`, pure + exported): single → string, `multiple` →
  `string[]`. The api handler already forwards param values untouched, so an
  action with a `file` param POSTs `attachments: string[]`.

This lets the approvals inbox retire its last hand-wired UI — the approve/reject
composer with its bespoke attachment upload — so the drawer renders every
decision through `DeclaredActionsBar` with the declared `attachments` file param
(framework side declares it; see the paired framework change). `DeclaredActionsBar`'s
`exclude` prop stays as a general capability.
