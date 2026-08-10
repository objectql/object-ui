---
'@object-ui/i18n': patch
---

回填 `perm` + `home` 两命名空间 14 个缺失语言 key,十个语言包补齐(#3546 切片六)

`scripts/check-i18n-call-site-keys.mjs` 实测:14 个不重复 key / 14 个调用点(1:1),分布在权限集
记录的授权面摘要(`PermissionFacetLink`,ADR-0056 P1)与"一键发布全部草稿"的其余几条 toast
(`usePublishAllDrafts`:ADR-0038 L3 探针健康、示例数据健康、ADR-0066 ⑨ 能力引用巡检)。

这 14 处都带内联 `defaultValue`,所以英文一直正常渲染,**十种语言都翻不了** —— 修的是这一半。
英文字串一字未改:9 处静态 `defaultValue` 与 en 逐字节相同;另外 4 个计数标签(对象 / 字段规则 /
RLS 策略 / 标签页规则)的 `defaultValue` 是带英文单复数分支的模板串,改用 i18next 复数族
(`key` + `key_one`)后逐个计数渲染结果与模板串一致。

复数族刻意带**基础 key** 而不是只写 `_one`/`_other`:i18next 只按语言的 CLDR 类别取一个后缀,
取不到就沿 fallback 链落到 `en`。ru(few 2-4、many 5-20)与 ar(two、few 3-10、many 11-99)
恰好在用户最先遇到的计数上会因此显示英文;基础 key 让这些类别落回**本语言**。
