---
'@object-ui/create-plugin': minor
---

Ask for the plugin's licence and ship the text it claims (objectui#8041, director
decision batch #91, 2026-09-08).

**The defect.** `buildPackageJson` wrote `license: 'MIT'` into every generated
manifest — unconditionally, and without ever asking — while `buildPluginFiles`
emitted nine files, none of them a LICENSE. The generated manifest declares no
`files` array, so `npm pack` takes npm's default set, which packs `LICENSE*`
whether or not anything lists it; the file simply was not on disk to pack. An
author who published a freshly scaffolded plugin therefore shipped a tarball that
**claimed a licence it did not carry**, on a choice made for them by this
generator.

**What changes, for a scaffolded package.**

- The scaffolder now asks `License:` as a chooser over `MIT`, `Apache-2.0`,
  `BSD-3-Clause` and `ISC`, with **MIT preselected**. It is the fourth question,
  after plugin name, description and author; the first three are unchanged.
- The emitted file set goes from **nine files to ten** — a `LICENSE` carrying the
  full text of whatever was chosen, with the copyright line filled in from the
  author and the current year. When the author prompt was left blank the holder
  reads `the <package name> authors` rather than trailing off after the year.
- The manifest's `license`, the README's `## License` section and the licence
  named in the four emitted source-file headers all follow the choice, instead of
  four of them saying MIT while the fifth says something else.
- **A non-interactive run takes MIT and still writes the text.** A non-TTY stdin,
  a cancelled prompt and any unrecognised value all resolve to MIT; there is no
  input for which the generator emits a licence claim with no text beside it.

Omitting `license` instead was refused on the record: an unlicensed manifest reads
as all-rights-reserved on npm, which is the worse default for the author this
change is written for. The four licence texts are copied verbatim from canonical
copies rather than retyped — a paraphrased licence is not a licence, and a
transcription typo in one is invisible to every gate this repository has.

Nothing an already-generated plugin does changes; this moves what the next one is
born with.
