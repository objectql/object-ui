---
'@object-ui/react': minor
'@object-ui/plugin-form': minor
'@object-ui/app-shell': minor
---

A form's ruled `submitBehavior.url` redirect can now be performed by the HOST, so a destination stays inside a console mounted at a sub-path (objectui#4989 defect 4).

`ObjectForm` and `WizardForm` accept a relative in-app path and used to travel to it with `window.location.assign`. A rooted path resolves against the ORIGIN there, so under a mounted host — `<BrowserRouter basename="/_console">`, which the framework CLI configures for every embedded deployment — an authored `/thanks` left the application. The destination was correct and the navigation was wrong, and a published renderer cannot fix that alone: only the host knows its mount.

**New: `HostNavigationContext` (`@object-ui/react`).** A host offers its own navigate; a renderer uses it when it is there:

```tsx
import { HostNavigationProvider } from '@object-ui/react';
import { useNavigate } from 'react-router-dom';

function Bridge({ children }) {
  const navigate = useNavigate();
  return (
    <HostNavigationProvider value={{ navigate: (to, o) => navigate(to, { replace: o?.replace ?? false }) }}>
      {children}
    </HostNavigationProvider>
  );
}
```

`@object-ui/app-shell`'s `ConsoleShell` now mounts that bridge above every console route, so the console's own routes, and its basename, are what a post-submit redirect resolves against — and the redirect becomes an SPA transition instead of a full page load.

**Nothing changes for a host that wires nothing.** With no provider the behaviour is byte-for-byte what it was: one `window.location.assign` of the resolved path after the declared `delayMs`. A host with no router has no basename, so origin-rooted resolution is already right there — the seam changes what a MOUNTED host gets and nothing else. `useHostNavigation()` outside a provider answers `{ navigate: undefined }` and never throws.

Two mechanisms were weighed and rejected by the ruling, recorded so they are not re-proposed. **Reading React Router's context when a router happens to be present** is implicit, and unavailable anyway: a React context is a module-instance object, so reading the host's means importing `react-router` into the renderer — which `@object-ui/plugin-form` declares in none of its dependency fields, whose published build externalises every bare specifier, and which two real consumers (`apps/site`, `packages/plugin-view`) do not install. **Requiring `react-router` as a peer** is the honest version of the same thing and costs the package its property of dropping into any React application.

What the host takes on by supplying a navigate: the destination becomes a client-side transition, so an in-app path with no matching route renders the host's not-found instead of a full page load. That is the host's routing table to answer for, which is why the choice is the host's. The contract verdict is unchanged either way — a destination `@objectstack/spec` refuses is refused identically with or without a seam, so an injected navigate can never launder a value the authoring door rejects.

`navigateOnSuccess` is a different declared key with its own open contract question (objectui#5034) and is deliberately untouched here.
