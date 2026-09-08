---
---

Test-only (objectui#8532). `ObjectKanban.contractEnvelope-6839` waited on the
`'Negotiation'` column header — a signal the `React.lazy` chunk reveals
independently of the data commit — and then read the cards synchronously, so
the pin went red on `main` on PRs that cannot reach `plugin-kanban`. The three
positive arms now wait FOR the rows; the `records` refusal arm, which has no
arrival to wait for, takes a settled read against the card list itself rather
than the header. No published source changed.
