---
---

CI only — this publishes nothing, declared explicitly with an empty frontmatter rather
than left undeclared. `ci.yml`'s coverage lane is sharded 4 ways with a blob-report
merge, and the Codecov upload can no longer go missing in silence: the merge job states
on every path whether Codecov received a report for the commit, and is red when it did
not.
