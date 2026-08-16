---
'@object-ui/plugin-report': patch
---

报表内嵌图表的度量显示名按三级回落解析，不再直接印原始 `name`

数据集绑定的 report chart 此前把度量原样交给图表组件（`series: [{ dataKey }]`，无 label），
于是图例、标记 tooltip 与单值卡片的说明文字都落回 dataKey——在全中文控制台上打出
`potential_upside_tons`，而同一张报表下方的汇总表、以及绑定同一数据集的 dashboard 图表
都能正确解析出授权 `label`。`ReportChartSchema` 自 rc.1 起声明的 `series[].label` 也从未
被读取，作者因此没有任何可授权的手段控制这个字符串。

现按三级回落解析，与汇总表和 dashboard 的既有口径对齐：

1. `chart.series[]` 中 `name` 命中该度量的条目的 `label`（spec 的 `I18nLabel`，按控制台
   语言解析；同名重复以第一条为准）；
2. 绑定数据集的度量 `label`（结果字段的 `label`，即汇总表表头一直在读的同一个值）；
3. 度量 `name` 兜底。

图例与 tooltip 同源同修：`ChartRenderer` 把 series 的 `label` 写进 `config[dataKey].label`，
三处读的是同一个输入。单值族（`metric`/`kpi`/`gauge`）的说明文字与系列图共用这一次解析。
