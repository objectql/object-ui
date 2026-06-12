---
"@object-ui/console": patch
---

DeviceAuthPage preserves the full query string (runtime_name / runtime_version device context) through the login redirect — previously only user_code survived, so a signed-out approver never saw what device they were authorizing.
