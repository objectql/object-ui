---
"@object-ui/plugin-chatbot": minor
---

feat(plugin-chatbot): render AI data-query charts inline (`data-chart`)

Companion to the framework `visualize_data` tool: the data-query assistant can
now answer with a CHART rendered right in the assistant bubble.

- `mapMessages.ts` — `extractCharts()` lifts every `data-chart` custom stream
  part onto `ChatMessage.charts` (defensive narrowing; preserves multiple charts
  in order), mirroring the existing `data-build-progress` → `buildProgress` path.
- `ChatbotEnhanced.tsx` — renders each chart via `<SchemaRenderer schema={{
  type:'chart', … }}/>` (decoupled — no hard dep on `plugin-charts`), giving the
  chart a definite `width: min(520px, 80vw)` so recharts' `ResponsiveContainer`
  measures a stable non-zero width inside the `w-fit` bubble (otherwise the
  circular width dependency leaves bars unpainted).
