---
'@object-ui/types': patch
---

`ClassNameStylePropsSchema` describes itself by its two keys (objectui#7578).

The schema's `.describe()` text changes from `Style properties` to
`className and inline style`. **This is published runtime metadata, not a
comment**: on this package `.describe()` is what lands in the generated
JSON-Schema `description` field and in the derived docs, so a consumer that
renders or diffs those will see the new string. The object itself is unchanged —
same two optional keys (`className`, `style`), same accept set, same types, same
export name; nothing validates differently.

Why it moved. objectui#5928 renamed the const away from `StyleProps`, because
the like-named TypeScript `StyleProps` is the Tailwind-scale vocabulary
(`padding`, `margin`, `gap`, `backgroundColor`, ...) and shares zero keys with
these two. That rename only reached readers who can see the const name; the
description still said what the retired name said, so a reader who meets this
schema through generated JSON-Schema or docs was left hunting `padding` or `gap`
under a label that promised them. Naming the two keys ends that at the one place
that reader actually sees.

The new text uses the verbatim key spellings, so the label answers "what is in
here" with names the reader can act on. Pinned in
`packages/types/src/__tests__/classname-style-describe-7578.test.ts`, read off
the live schema exported by the published `@object-ui/types/zod` barrel.
