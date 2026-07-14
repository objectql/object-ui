---
'@object-ui/core': patch
'@object-ui/plugin-grid': patch
'@object-ui/plugin-list': patch
'@object-ui/i18n': patch
---

导出/导入模板的下载文件名与内容本地化。

**导出文件名**:CSV/Excel/JSON 导出下载不再是 `<对象名>.<扩展名>`(如 `contracts.csv`),改为「对象显示名-时间戳.扩展名」(如 `合同-20260714-153045.xlsx`);`exportOptions.fileNamePrefix` 配置仍优先。`@object-ui/core` 新增 `buildExportFileName(ext, { prefix, label, objectName }, now?)` 与 `sanitizeFileNameBase(raw)`,ObjectGrid 与 ListView 的所有导出路径(服务端流式与前端兜底)统一走它。

**导入模板**:「下载模板」修复两处英文漏出——示例行的 select/多选取值改为优先取选项**显示标签**(如 `准备中`)而非 ASCII slug(`prepare`,服务端导入两者都接受);模板文件名本地化为 `{{object}}-导入模板.csv`(新增 i18n key `grid.import.templateFileName`,英文回退 `{{object}}-import-template.csv`)。
