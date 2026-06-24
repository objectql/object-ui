---
'@object-ui/app-shell': patch
---

fix(ai): stop the AI composer placeholder doubling to "Ask Ask…" for the Ask agent

The composer placeholder is `Ask {agent}…`, which reads fine for most agents
("Ask Build…") but doubles to "Ask Ask…" for the data-query agent whose label is
literally "Ask". The Ask agent now uses its purpose-built placeholder
(`console.ai.askAnything` → "Ask anything…", already localized) instead. Found
dogfooding the AI Ask flow.
