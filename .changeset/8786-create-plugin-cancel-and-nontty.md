---
'@object-ui/create-plugin': minor
---

Make the documented non-interactive run real, and stop a cancelled prompt from
crashing the generator (objectui#8786).

**The defect.** `prompts` hands back the answers given SO FAR when a question is
cancelled — the cancelled question and every question after it are simply absent
— and the generator read `answers.author` raw. Cancelling at `Plugin
description:` or `Author name:` therefore reached
`licenseCopyrightHolder(vars)`, dereferenced `undefined.trim()`, and died with a
`TypeError` and exit 1. It died *after* the target directory had been created,
so it left an empty `packages/plugin-NAME/` behind and the obvious retry failed
on "Directory already exists" instead. Cancelling at the fourth question
(`License:`) was unaffected, because nothing is left unanswered after it.

**The false claim.** The README promised that "a non-interactive run (no TTY, or
a cancelled prompt) takes MIT and still writes the text". `prompts` never
settles on a stdin that is not a TTY: no `submit`, no `abort`, the process ran
out of work and exited 0 having written nothing at all, in silence.

**One rule now covers both.** An answer that is not given takes the default its
prompt offered, and the complete ten-file set is still written — whether the run
was cancelled or never had a TTY to ask on. The plugin name keeps its own
behaviour, being the one answer with no default: a run that reaches the name
prompt with no TTY, or cancels it, now prints `Plugin name is required` and
exits 1 without creating anything (it used to exit 0 in silence). `--description`
and `--author` set the defaults such a run writes, so
`create-plugin my-plugin --author "Ada"` scaffolds correctly from a CI step.

Nothing an interactive, fully answered run produces changes, and neither does
what a cancel at `License:` produces: MIT and the same ten files. Templating now
also happens before anything is created on disk, so no failure inside
`buildPluginFiles` can leave a half-created directory behind.
