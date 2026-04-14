/**
 * @object-ui/app-shell
 *
 * Minimal Application Shell for ObjectUI
 * Framework-agnostic rendering engine for third-party integration
 */

export { AppShell } from './components/AppShell';
export { ObjectRenderer } from './components/ObjectRenderer';
export { DashboardRenderer } from './components/DashboardRenderer';
export { PageRenderer } from './components/PageRenderer';
export { FormRenderer } from './components/FormRenderer';

export type {
  AppShellProps,
  ObjectRendererProps,
  DashboardRendererProps,
  PageRendererProps,
  FormRendererProps,
} from './types';
