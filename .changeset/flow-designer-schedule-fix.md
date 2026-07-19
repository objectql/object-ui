---
"@object-ui/app-shell": patch
---

fix(flow-designer): author the canonical `config.schedule` a scheduled flow's runtime reads

The start-node inspector's "Cron schedule" field wrote a flat `config.cron`, but the
automation runtime (`resolveTriggerBinding` → `normalizeSchedule`) only ever reads
`config.schedule` — so a scheduled flow authored in the designer silently never
bound and never fired. The field now writes the canonical nested
`config.schedule.expression`, and a `fallbackPath` migrates an existing flat
`config.cron` on first edit. Reading `.expression` also renders an object-shaped
`config.schedule` (e.g. `{ type: 'cron', expression }`) as its cron string instead of
"[object Object]" (the old legacy text field on `config.schedule` printed the object).
The canvas node-card summary reads the nested value too. The field is also offered for
the `time_relative` sweep cadence (optional; defaults to daily).
