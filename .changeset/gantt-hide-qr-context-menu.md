---
"@object-ui/plugin-gantt": patch
---

fix(plugin-gantt): temporarily disable the 移动端二维码 (mobile QR share) context-menu item

The QR item in the gantt row context menu is commented out for now: right-click
no longer offers "Mobile QR code", and `taskUrl` alone no longer opens a menu
(it would be empty without the QR item). The `taskUrl` prop, the QR dialog code,
and the original tests are kept in place (commented / skipped) so the feature
can be restored by uncommenting the marked TODO(qr-menu) blocks.
