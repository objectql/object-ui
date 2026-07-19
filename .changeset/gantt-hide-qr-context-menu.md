---
"@object-ui/plugin-gantt": patch
"@object-ui/i18n": patch
---

feat(plugin-gantt)!: remove the 移动端二维码 (mobile QR share) context-menu item

The QR-share feature is removed outright: the context-menu item, the QR dialog,
the `taskUrl` prop on `GanttView`, the URL wiring in `ObjectGantt`, the
`gantt.menu.qrcode` / `gantt.qr.*` i18n keys (en/zh) and the `qrcode`
dependency are all deleted. It baked one consumer's app-specific requirement
(scan-to-open on mobile) into the generic gantt renderer, and what it encoded —
the desktop console record URL — was not even the right target for that
requirement. Apps that need scan-to-mobile flows should implement them
app-side against their own mobile surface.
