---
"@object-ui/console": patch
---

fix(console): object-detail page uses the valid `record` PageType

`buildObjectDetailPageSchema` emitted `pageType: 'record_detail'`, which was
dropped from `PageType` (`record | home | app | utility`) in framework#2265 /
objectui#1949 — a `tsc` error (TS2322) that broke the console build (Bundle
Analysis). An object detail page is a `record` page; use that.
