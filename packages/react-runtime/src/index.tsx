/**
 * ObjectUI — @object-ui/react-runtime (ADR: kind:'react')
 *
 * Inlined, vendored react-runner (github.com/nihgwu/react-runner, MIT): transpile
 * a JSX/TSX source string with Sucrase, then eval it with an injected scope
 * (React, your registered components, page data) and render in the MAIN React
 * tree. NO sandbox — this is the *trusted* execution tier, gated to enterprise/
 * private deployments where authors are trusted. Inlined (not depended) so we
 * fully control the scope/imports surface and can lazy-load it behind a flag.
 */
import React, { Component, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { transform as sucrase } from 'sucrase';

export type Scope = Record<string, unknown>;

const normalizeCode = (code: string): string =>
  code.replace(/^(\s*)(<[^>]*>|function[(\s]|\(\)[\s=]|class\s)(.*)/, '$1export default $2$3');

/** Transpile JSX/TS → JS (classic runtime; imports → require). */
export const transform = (code: string): string =>
  sucrase(code, { transforms: ['jsx', 'typescript', 'imports'], production: true }).code.substring(13);

const createRequire =
  (imports: Scope = {}) =>
  (module: string): unknown => {
    if (!Object.prototype.hasOwnProperty.call(imports, module)) {
      throw new Error(`Module not found: '${module}' — provide it via the runtime scope.imports`);
    }
    return imports[module];
  };

const evalCode = (code: string, scope: Scope): unknown => {
  const { default: _d, import: imports, ...rest } = scope as Scope & { import?: Scope };
  const finalScope: Scope = { React, require: createRequire(imports), ...rest };
  const keys = Object.keys(finalScope);
  // eslint-disable-next-line no-new-func
  return new Function(...keys, code)(...keys.map((k) => finalScope[k]));
};

/** Transpile + eval a source string into a React element (or null). */
export function generateElement(code: string, scope: Scope = {}): ReactElement | null {
  if (!code.trim()) return null;
  const exports: Scope = {};
  evalCode(transform(normalizeCode(code)), { render: (v: unknown) => (exports.default = v), ...scope, exports });
  const result = exports.default;
  if (!result) return null;
  if (isValidElement(result)) return result;
  if (typeof result === 'function') return createElement(result as React.ComponentType);
  return null;
}

export interface ReactRunnerProps {
  code: string;
  scope?: Scope;
  /** rendered when the code throws at transpile/eval/render time */
  fallback?: (error: Error) => ReactNode;
  onError?: (error: Error) => void;
}

interface ReactRunnerState {
  element: ReactElement | null;
  error: Error | null;
}

/** Renders a JSX/TSX source string with a built-in error boundary. */
export class ReactRunner extends Component<ReactRunnerProps, ReactRunnerState> {
  state: ReactRunnerState = { element: null, error: null };

  static getDerivedStateFromProps(props: ReactRunnerProps): Partial<ReactRunnerState> | null {
    try {
      return { element: generateElement(props.code, props.scope), error: null };
    } catch (error) {
      return { element: null, error: error as Error };
    }
  }
  static getDerivedStateFromError(error: Error): Partial<ReactRunnerState> {
    return { error };
  }
  componentDidUpdate(): void {
    if (this.state.error) this.props.onError?.(this.state.error);
  }
  render(): ReactNode {
    if (this.state.error) {
      return this.props.fallback
        ? this.props.fallback(this.state.error)
        : createElement('pre', { style: { color: 'crimson', padding: 16, whiteSpace: 'pre-wrap' } }, String(this.state.error));
    }
    return this.state.element;
  }
}
