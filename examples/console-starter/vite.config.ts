import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Workspace src/ aliases ensure plugin side-effect imports
// (ComponentRegistry.register) resolve to the same singleton instance, mirroring
// what apps/console does. Customers shipping a real app can drop these aliases
// once the @object-ui/* packages are published to a registry.
//
// The table must be CLOSED under the import graph it creates: every alias points
// at a package's `src`, and that source imports further @object-ui/* packages,
// which must be aliased too. A package left out falls back to node resolution
// and lands on that package's `dist`, which only exists after `pnpm -w build` —
// so `pnpm dev` on a fresh clone served 500s for those modules and rendered a
// blank `#root` with nothing on the page to say why (objectui#3528). Five
// packages had drifted out of the list that way.
// `test/vite-alias-closure.test.ts` re-derives the closure from the real import
// graph and fails when it drifts again — do not hand-maintain this list against
// memory.
const workspaceAliases: Record<string, string> = {
  '@object-ui/app-shell': path.resolve(__dirname, '../../packages/app-shell/src'),
  '@object-ui/auth': path.resolve(__dirname, '../../packages/auth/src'),
  '@object-ui/collaboration': path.resolve(__dirname, '../../packages/collaboration/src'),
  '@object-ui/components': path.resolve(__dirname, '../../packages/components/src'),
  '@object-ui/core': path.resolve(__dirname, '../../packages/core/src'),
  '@object-ui/data-objectstack': path.resolve(__dirname, '../../packages/data-objectstack/src'),
  '@object-ui/fields': path.resolve(__dirname, '../../packages/fields/src'),
  '@object-ui/i18n': path.resolve(__dirname, '../../packages/i18n/src'),
  '@object-ui/layout': path.resolve(__dirname, '../../packages/layout/src'),
  '@object-ui/mobile': path.resolve(__dirname, '../../packages/mobile/src'),
  '@object-ui/permissions': path.resolve(__dirname, '../../packages/permissions/src'),
  '@object-ui/plugin-calendar': path.resolve(__dirname, '../../packages/plugin-calendar/src'),
  '@object-ui/plugin-charts': path.resolve(__dirname, '../../packages/plugin-charts/src'),
  '@object-ui/plugin-chatbot': path.resolve(__dirname, '../../packages/plugin-chatbot/src'),
  '@object-ui/plugin-dashboard': path.resolve(__dirname, '../../packages/plugin-dashboard/src'),
  '@object-ui/plugin-designer': path.resolve(__dirname, '../../packages/plugin-designer/src'),
  '@object-ui/plugin-detail': path.resolve(__dirname, '../../packages/plugin-detail/src'),
  '@object-ui/plugin-editor': path.resolve(__dirname, '../../packages/plugin-editor/src'),
  '@object-ui/plugin-form': path.resolve(__dirname, '../../packages/plugin-form/src'),
  '@object-ui/plugin-grid': path.resolve(__dirname, '../../packages/plugin-grid/src'),
  '@object-ui/plugin-kanban': path.resolve(__dirname, '../../packages/plugin-kanban/src'),
  '@object-ui/plugin-list': path.resolve(__dirname, '../../packages/plugin-list/src'),
  '@object-ui/plugin-report': path.resolve(__dirname, '../../packages/plugin-report/src'),
  '@object-ui/plugin-view': path.resolve(__dirname, '../../packages/plugin-view/src'),
  '@object-ui/providers': path.resolve(__dirname, '../../packages/providers/src'),
  // '@object-ui/react' does NOT shadow '@object-ui/react-runtime': an alias key
  // matches an importee only when it equals it or is a prefix ending at a '/'
  // boundary, so the order of these keys is presentation, not precedence.
  '@object-ui/react': path.resolve(__dirname, '../../packages/react/src'),
  '@object-ui/react-runtime': path.resolve(__dirname, '../../packages/react-runtime/src'),
  '@object-ui/sdui-parser': path.resolve(__dirname, '../../packages/sdui-parser/src'),
  '@object-ui/types': path.resolve(__dirname, '../../packages/types/src'),
};

export default defineConfig({
  plugins: [react()],
  resolve: { alias: workspaceAliases },
});
