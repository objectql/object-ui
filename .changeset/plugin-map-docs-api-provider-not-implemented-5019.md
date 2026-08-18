---
---

Docs-only (objectui#5019). `content/docs/plugins/plugin-map.mdx` no longer teaches
`data.provider: 'api'` as a working configuration.

The "API Provider" section showed `data: { provider: 'api', endpoint: '/api/locations',
method: 'GET' }` next to a `map` block, as one of three interchangeable providers.
`ObjectMap` has no fetch implementation on that path: the branch logs
`API provider not yet implemented for ObjectMap` and sets the record set to empty, and
`endpoint` / `method` have no read point anywhere in the package — a reader who copied the
section got an empty map and a console warning, with nothing to say why. Without a
`DataSource` the same schema fails one step earlier, on
`DataSource required for object/api providers`.

The section now states that plainly and points at the object and value providers instead;
the example that configured the dead branch is gone. Implementing `provider: 'api'` was
deliberately out of scope — that is capability expansion, not documentation alignment — so
the page promises nothing about it either way.

The page's other known defect from the same report, the `MapConfig` import that
`@object-ui/types` never exported, is fixed in objectui#5156 (implementing objectui#5018's
ruling, which lifts the config into the published type surface as `ObjectMapConfig`) and is
untouched here.

No published package source was touched — documentation only, so nothing is released by
this changeset.
