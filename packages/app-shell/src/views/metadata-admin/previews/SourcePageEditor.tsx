/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * SourcePageEditor — the Studio editor surface for `kind:'html'` and
 * `kind:'react'` pages (ADR-0080/0081). These pages ARE a `source` string
 * (JSX/HTML or real React), not a region tree — so the structured design
 * canvas does not apply (and would choke on the missing `regions`/`children`).
 * Instead we present a code editor for the `source` field beside a live preview
 * rendered through the runtime SchemaRenderer. Edits patch `draft.source`.
 *
 * The `mode` prop lets the Studio split the two halves apart: the inspector
 * hosts the editor (`mode:'editor'`) while the canvas owns the live preview
 * (`mode:'preview'`); standalone callers keep the `split` default.
 *
 * Mirrors JsonSourceEditor's Monaco + textarea-fallback + theme handling, but
 * edits ONE field (the source) instead of the whole-record JSON, with a
 * JSX/TSX language mode.
 */

import * as React from 'react';
import { Skeleton } from '@object-ui/components';
import { SchemaRenderer } from '@object-ui/react';
import { PreviewShell, PreviewErrorBoundary } from './PreviewShell';
import { useMonacoFallback } from '../useMonacoFallback';

const LazyMonaco = React.lazy(async () => {
  const mod = await import('@monaco-editor/react');
  return { default: mod.default };
});

export interface SourcePageEditorProps {
  draft: Record<string, unknown>;
  /** Patch the draft; undefined in read-only mode. */
  onPatch?: (patch: Record<string, unknown>) => void;
  readOnly?: boolean;
  fallbackDelayMs?: number;
  /**
   * Which halves to render.
   * - `split` (default): code editor + live preview side by side (standalone use).
   * - `editor`: code editor only — the Studio hoists it into the inspector's
   *   Source tab and lets the canvas own the preview.
   * - `preview`: live preview only — the Studio canvas for source pages.
   */
  mode?: 'split' | 'editor' | 'preview';
}

/**
 * Silence the TypeScript worker for these editors. `kind:'html'` pages are
 * JSX-flavoured HTML with intrinsic tags the platform resolves at runtime
 * (`<flex>`, `<grid>`), no `import React`, and `style={{…}}` object literals —
 * so full TS type-checking floods the gutter with red squiggles that mean
 * nothing here (the live preview + server-side validation are the real source
 * of truth). Configure JSX and drop semantic/syntax diagnostics before the
 * first editor mounts.
 */
type MonacoNS = {
  languages: {
    typescript: {
      typescriptDefaults: {
        setDiagnosticsOptions: (o: {
          noSemanticValidation: boolean;
          noSyntaxValidation: boolean;
          noSuggestionDiagnostics?: boolean;
        }) => void;
        setCompilerOptions: (o: Record<string, unknown>) => void;
      };
      JsxEmit: { React: unknown };
      ScriptTarget: { Latest: unknown };
    };
  };
};
function configureMonacoForSource(monaco: MonacoNS): void {
  const ts = monaco.languages.typescript;
  ts.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
    noSuggestionDiagnostics: true,
  });
  ts.typescriptDefaults.setCompilerOptions({
    jsx: ts.JsxEmit.React,
    target: ts.ScriptTarget.Latest,
    allowNonTsExtensions: true,
    allowJs: true,
    noEmit: true,
  });
}

export function SourcePageEditor({
  draft,
  onPatch,
  readOnly,
  fallbackDelayMs = 4000,
  mode = 'split',
}: SourcePageEditorProps) {
  const kind = (draft as { kind?: string }).kind === 'react' ? 'react' : 'html';
  const source = typeof draft.source === 'string' ? (draft.source as string) : '';

  const [text, setText] = React.useState(source);
  const lastCommittedRef = React.useRef(source);

  // Sync from upstream (Reset / inspector edits) without clobbering keystrokes.
  React.useEffect(() => {
    if (source !== lastCommittedRef.current) {
      setText(source);
      lastCommittedRef.current = source;
    }
  }, [source]);

  // Monaco-unavailable fallback (headless / CSP / air-gapped) → plain textarea.
  // Fast-fails the moment the CDN loader rejects instead of waiting the full
  // grace period; see useMonacoFallback.
  const [monacoUnavailable, containerRef] = useMonacoFallback(fallbackDelayMs);

  const [theme, setTheme] = React.useState<'vs-dark' | 'light'>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'vs-dark' : 'light',
  );
  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const update = () => setTheme(root.classList.contains('dark') ? 'vs-dark' : 'light');
    const obs = new MutationObserver(update);
    obs.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const handleChange = (next: string | undefined) => {
    const v = next ?? '';
    setText(v);
    lastCommittedRef.current = v;
    onPatch?.({ source: v });
  };

  const previewSchema = React.useMemo(
    () => ({ ...(draft as Record<string, unknown>), type: (draft as { type?: string }).type ?? 'page' }),
    [draft],
  );

  const editorEl = (
    <div ref={containerRef} className="h-full min-h-[260px] overflow-hidden bg-background">
      {monacoUnavailable ? (
        <textarea
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          readOnly={readOnly}
          spellCheck={false}
          aria-label="Page source"
          className="h-full w-full resize-none bg-background p-3 font-mono text-xs leading-relaxed outline-none"
        />
      ) : (
        <React.Suspense fallback={<Skeleton className="h-full w-full" />}>
          <LazyMonaco
            value={text}
            language="typescript"
            path={kind === 'react' ? 'page.tsx' : 'page.html.tsx'}
            theme={theme}
            beforeMount={configureMonacoForSource}
            onChange={handleChange}
            options={{
              readOnly,
              minimap: { enabled: false },
              fontSize: 12,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              folding: true,
              wordWrap: 'on',
              tabSize: 2,
              scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
            }}
          />
        </React.Suspense>
      )}
    </div>
  );

  const previewEl = (
    <div className="h-full min-h-[260px] overflow-auto bg-muted/20">
      <PreviewErrorBoundary fallbackHint="The page source threw while rendering — fix the code in the Source tab.">
        <SchemaRenderer schema={previewSchema as never} />
      </PreviewErrorBoundary>
    </div>
  );

  // Editor-only: the Studio hosts this inside the inspector's Source tab, which
  // supplies its own chrome/height — render the bare editor so it fills.
  if (mode === 'editor') return editorEl;

  if (mode === 'preview') {
    return <PreviewShell hint={`page · ${kind} source`}>{previewEl}</PreviewShell>;
  }

  return (
    <PreviewShell hint={`page · ${kind} source`}>
      <div className="grid h-full grid-cols-1 divide-y divide-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        {editorEl}
        {previewEl}
      </div>
    </PreviewShell>
  );
}

export default SourcePageEditor;
