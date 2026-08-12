---
'@object-ui/plugin-dashboard': patch
---

Dashboard global filters sourced from `optionsFrom` now commit the RAW value instead of the display label.

The option source is a server GROUP BY whose response carries both forms of every grouped value: `rows` holds the resolved display labels (`{status: 'In Review'}`) and the index-aligned `drillRawRows` holds the raw stored values (`{status: 'in_review'}`). `DashboardFilterBar` read the value off `rows`, so picking an option broadcast a label no record carries into every bound widget's `runtimeFilter` and each widget repainted to "No rows". Options are now paired index-wise — value from `drillRawRows`, label from the displayed row — mirroring how the drill path has always read the same response. The trigger still displays the label, and statically declared `options` are unaffected. When the raw rows are absent, disagree in length with `rows`, or carry no such field, the previous read is kept rather than guessing at a pairing.
