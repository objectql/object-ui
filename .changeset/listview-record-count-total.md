---
"@object-ui/plugin-list": patch
---

fix(list): show the real match total in the record-count status bar under server pagination

The Airtable-style record-count bar read `data.length`, but under server-side
pagination (#2212) `data` is only the current page window — so a 158-row result
paginated 100/page reported "100 条记录" on page 1 and "58 条记录" on page 2,
never the true total. There was no other place to see how many records the
query matched.

The bar now shows the server's grand total (`serverTotal`) when known, falling
back to `data.length` when the whole result set is in memory (non-paginated,
grouped and non-grid views are unchanged — `serverTotal` is null there, so the
count is identical to before). Browser-verified against the showcase contacts
list: the bar reads "158 条记录" and stays stable across pages, and switching to
grouped/other views correctly resets to the loaded count.
