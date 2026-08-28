---
'@object-ui/app-shell': minor
---

设计⇄运行 on the Interfaces canvas (#5800): a two-state switch in the canvas header flips the SAME renderer between design (selection + inspector + design overlays) and an interactive runtime (click 新建, enter records) — ADR-0080's design=run pivot made visible; selection context survives the round trip. The topbar's 打开应用 teleport is retired (run mode is the in-workbench way to try the app), and the topbar's app detection now matches the pillar's (draft-app fallback, re-resolved on draft saves and the metadata-refresh pulse) so a deep-link to /access can no longer claim the package has no app while /data shows one.
