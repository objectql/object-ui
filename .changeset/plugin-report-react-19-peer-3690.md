---
'@object-ui/plugin-report': patch
---

Accept React 19 in `@object-ui/plugin-report`'s peer range, the last UI package still declaring React 18 alone (objectui#3690).

`peerDependencies.react` and `peerDependencies.react-dom` widen from `^18.0.0` to `^18.0.0 || ^19.0.0`, matching the other 29 packages in the fixed version group. With npm 7+ resolving peers strictly, a React 19 consumer installing this published package hit an `ERESOLVE` on first install while every sibling installed clean — and the package's own README already documented the wider range, so the manifest was the half that was wrong.

The narrow range was never a constraint anyone stated. `packages/plugin-report/package.json` was hand-authored on 2026-02-06 (`1e557cbda`), by which point nineteen sibling packages already carried `^18.0.0 || ^19.0.0` and every package created afterwards was born with it; the one other package born narrow, `plugin-dashboard`, was corrected on 2026-05-08 (`d2b6ecec6`) in a build fix that touched only itself. No commit in the file's 172-commit history ever revisited the peer line, and no commit message mentions a React 18 requirement.

Nothing in the package needs React 18. Its entire React surface is `React.FC`, `useState`, `useEffect`, `useMemo`, `useReducer`, `useContext`, `Fragment`, `ComponentType`, `CSSProperties` and `ReactNode` — all unchanged in React 19 — with zero uses of anything React 19 removed (`ReactDOM.render`, `unmountComponentAtNode`, `findDOMNode`, legacy context, string refs, `defaultProps` / `propTypes` on function components, `createFactory`, `useFormState`, `react-dom/test-utils`). `react-dom` is not imported by the source at all; it appears only as a UMD global name in the Vite externals config. The workspace pins `react` to 19.2.8 via a root `pnpm.overrides`, so this package's 78 tests have been running against React 19 the whole time it declared it did not support it.
