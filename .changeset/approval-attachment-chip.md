---
"@object-ui/console": patch
"@object-ui/i18n": patch
---

fix(console): make the approval timeline attachment chip show its name and open (#2820)

A decision attachment in the approval inbox timeline (审批动态) rendered a
nameless "附件" chip that did nothing when clicked. Three separate bugs:

- **No filename.** The chip resolved its label by fetching `/data/sys_file/{id}`
  — a system object a regular approver cannot read — and silently fell back to a
  generic label when that was denied. The name now comes from the attachment
  descriptor the server returns (framework #3266), so no `sys_file` access is
  needed and the real filename shows for every approver.
- **Dead click.** `openAttachment` called `window.open` *after* an `await`, so
  it was no longer a user gesture and the browser blocked the popup. It now opens
  the tab synchronously up front, then points it at the signed URL once fetched.
- **Wrong origin.** The signed URL from the local storage adapter is
  server-relative; `window.open` resolved it against the console origin. It is
  now resolved against the API origin.
- Every open failure was swallowed silently. The user now gets a toast on
  failure — new `approvalsInbox.attachmentOpenFailed` string across all 10
  locales.
