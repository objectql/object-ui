---
'@object-ui/cli': patch
---

`dev`, `serve` and `build` accept the documented directory argument from anywhere, and refuse a non-project directory in plain language.

`content/docs/utilities/cli.mdx` has recorded the positional argument as "Path
to JSON/YAML schema file or `pages/` directory" and printed `objectui dev
pages/` as the file-system-routing example. That promise had never actually been
parsed. Detection's first step required `statSync(...).isFile()`, so a directory
argument fell straight through it; the one spelling that worked — `objectui dev
pages/` from inside the project — worked by coincidence of position, caught by
the working-directory fallback rather than read as an argument. Every pathful
spelling reached single-schema mode and handed a directory to `readFileSync`:

```
$ objectui dev my-app/pages
Error: Invalid schema file: EISDIR: illegal operation on a directory, read
```

A directory argument now resolves through file-system routing in the shared
resolution step the three commands were centralized on (objectui#4923), in
either of the two shapes a user can mean: the directory **is** a `pages`
directory, or it **contains** one. Both produce the same routed answer as naming
the app config beside them — same project root, same routes, same app config —
so `objectui dev my-app/pages`, `objectui dev my-app` and `objectui dev
my-app/app.json` agree, from any working directory, across all three commands.
The limb lives in the shared resolver, not in three command branches.

The remaining directory-shaped miss is now diagnosed instead of leaking a
`readFileSync` errno: a directory that is neither shape is refused by name,
saying what would have been accepted. The refusal sits **after** the
working-directory fallback, so nothing that resolves today stops resolving: this
change accepts strictly more than before and rejects nothing that worked.
