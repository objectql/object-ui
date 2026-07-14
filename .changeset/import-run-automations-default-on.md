---
'@object-ui/plugin-grid': patch
---

ImportWizard now defaults the "Run automations & triggers" checkbox to ON
(framework#2922): automations always ran on import before the server honored
the flag, so preserving behavior means opt-out rather than opt-in. The reset
path restores the same default.
