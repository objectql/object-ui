---
"@object-ui/app-shell": patch
---

fix(studio): close the three journey dead-ends found in UX review

- **Navigation**: the standalone `/studio` landing gets a slim frame with an
  ObjectOS wordmark → Home, and the builder top bar gets a Home button — the
  builder is no longer a browser-back-only dead end.
- **Fresh-package empty state**: an empty writable package no longer shows an
  endless 加载中… — the rail says 还没有对象, the main pane explains the first
  act (从第一个对象开始), and the object creator auto-opens.
- **创建应用 on-ramp**: when the package ships no app, the top-bar bridge slot
  offers 创建应用 (draft `app` item, name + identifier popover) instead of
  nothing; after creation it shows 应用「…」待发布, and flips to 打开应用 once
  the package publish lands.
