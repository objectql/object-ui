---
---

Tooling and tests only; no published behaviour changes.

Adds `check:designer-field-key-parity`, a gate that compares the field designers'
statically declared payload shapes (`FieldMetadataPayload`, `ServerFieldSchema`,
`DesignerFieldDefinition`) against the accept set of the installed
`@objectstack/spec` `FieldSchema`, plus the draft-I/O round-trip half as a test in
`@object-ui/app-shell`. Both are new checks over existing code — nothing shipped
in a package changed, and no offending key was fixed: each one the gate surfaced is
filed as its own card and recorded in the gate's ledger.
