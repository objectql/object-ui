---
'@object-ui/app-shell': minor
---

Studio: expose the object record sharing model (OWD) in the Data pillar Settings tab.

The object designer had no control for an object's `sharingModel` (Org-Wide Default), so record-level isolation was invisible and unconfigurable at design time — an admin who ticked Read/Edit in the permission matrix silently got org-wide read/write, because an unset `sharingModel` falls through to the runtime's fully-public default. `ObjectSettingsPanel` now renders a "Record sharing (OWD)" section with a `sharingModel` selector (`private` / `public_read` / `public_read_write` / `controlled_by_parent`), a per-option description of the runtime effect, and an amber warning when unset that spells out the fully-public default. Legacy aliases (`read` → `public_read`, `read_write`/`full` → `public_read_write`) are normalised to their canonical value for display. Fully localized (en-US / zh-CN).
