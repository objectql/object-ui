---
---

Test-only change: pins the metadata advisory sink seam (`useMetadataClient` ->
`createConsoleMetadataClient` -> `MetadataClient`), so an advisory the server
returns on a save or a publish is asserted to actually reach the toast. No
published behaviour changes.
