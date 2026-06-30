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
 * Mirrors JsonSourceEditor's Monaco + textarea-fallback + theme handling, but
 * edits ONE field (the source) instead of the whole-record JSON, with a
 * JSX/TSX language mode.
 */

import * as React from 'react';
import { Skeleton } from '@object-ui/components';
import { SchemaRenderer } from '@object-ui/react';
import { PreviewShell, PreviewErrorBoundary } from './PreviewShell';

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
}

export function SourcePageEditor({ draft, onPatch, readOnly, fallbackDelayMs = 4000 }: SourcePageEditorProps) {
  const kind = (draft as { kind?: string }).kind === 'react' ? 'react' : 'html';
  const source = typeof draft.source === 'string' ? (draft.source as string) : '';

  const [text, setText] = React.useState(source);
  const lastCommittedRef = React.useRef(source);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Sync from upstream (Reset / inspector edits) without clobbering keystrokes.
  React.useEffect(() => {
    if (source !== lastCommittedRef.current) {
      setText(source);
      lastCommittedRef.current = source;
    }
  }, [source]);

  // Monaco-unavailable fallback (headless / CSP) → plain textarea.
  const [monacoUnavailable, setMonacoUnavailable] = React.useState(false);
  React.useEffect(() => {
    if (monacoUnavailable) return;
    const id = setTimeout(() => {
      const el = containerRef.current;
      if (!el || !el.querySelector('.view-line')) setMonacoUnavailable(true);
    }, fallbackDelayMs);
    return () => clearTimeout(id);
  }, [monacoUnavailable, fallbackDelayMs]);

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

  return (
    <PreviewShell hint={`page · ${kind} source`}>
      <div className="grid h-full grid-cols-1 divide-y divide-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        {/* Code editor */}
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
        {/* Live preview through the real runtime */}
        <div className="h-full min-h-[260px] overflow-auto bg-muted/20">
          <PreviewErrorBoundary fallbackHint="The page source threw while rendering — fix the code on the left.">
            <SchemaRenderer schema={previewSchema as never} />
          </PreviewErrorBoundary>
        </div>
      </div>
    </PreviewShell>
  );
}

export default SourcePageEditor;
