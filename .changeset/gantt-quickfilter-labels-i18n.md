---
'@object-ui/plugin-gantt': patch
'@object-ui/i18n': patch
---

`ObjectGantt`'s quick-filter bar is now localized instead of pinned to Chinese. The four `QuickFilterBar` labels (`all`, `clear`, `empty`, `resultSummary`) were hardcoded as Chinese string literals at the `ObjectGantt` call site, so the bar read 全部 / 清除筛选 / 无可选项 / 显示 N / M 项任务 under an `en`, `ja`, `es` or `ar` session while the rest of the gantt toolbar localized correctly — a conspicuous mismatch, and a violation of the English-only-codebase rule. `QuickFilterBar` itself was never at fault: it is presentational and already falls back to English, so the host was the only thing pinning the copy.

The four strings moved into a new `gantt.quickFilter` namespace, added to all ten built-in locale packs, and the call site now resolves them through the gantt package's existing `useGanttTranslation` — the same per-key hook every other gantt string already uses, so a host dictionary that lags on these keys still renders the bundled English default rather than a raw key. `gantt.quickFilter.resultSummary` deliberately keeps SINGLE-brace placeholders (`{shown}` / `{total}`): the call site substitutes them with a literal `.replace`, not i18next interpolation, matching `gantt.autoScheduleDlg.body` and the placeholder convention `all-locales-key-parity` already recognises. Anyone retranslating these packs must keep that spelling — a respell to `{{shown}}` would render the raw placeholder to the user.
