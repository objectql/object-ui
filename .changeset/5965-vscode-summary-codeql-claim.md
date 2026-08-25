---
---

Doc-only removal in the (private, unpublished) `object-ui` VSCode extension package:
`packages/vscode-extension/SUMMARY.md` is deleted. The file asserted a security-scan
outcome that nothing ever produced — "CodeQL扫描通过 / 无安全漏洞 / 无已知问题"
("CodeQL scan passed / no security vulnerabilities / no known issues") — while this
repository has never had a CodeQL workflow, default-setup or otherwise. `CONTRIBUTING.md`
already states the opposite as the repo's canonical fact: it "does **not** run
static-analysis security scanning of its own source code (CodeQL or equivalent)".

The claim was not one line. It recurred as a release-checklist tick (`- [x] 安全扫描通过`)
and twice in the conclusion, alongside a matching `- [x] 单元测试通过` in a package that
carries zero test files — the document was a frozen one-off session status report
("代码完成度: 100%", "扩展已准备好发布到VSCode Marketplace"), not living documentation.
Nothing in the repository referenced it and it never shipped: the package is
`private: true`, and `.vscodeignore` excludes `*.md` except `README.md`, so it was absent
from the VSIX. Its durable reference content (commands, snippets, configuration, project
structure) is already carried by `README.md`, `DESIGN.md`, and `PUBLISHING.md`.

Also lowers two `objectui#4938` population floors in `scripts/__tests__/check-doc-links.test.ts`
by exactly this one deletion (packages/* 12→11, combined 15→14), so they keep failing if
the link scanner stops walking the tree.

No published source, behaviour, or shipped artifact changes.
