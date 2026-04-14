import type { PageRendererProps } from '../types';

/**
 * PageRenderer - Renders custom page schemas
 *
 * Framework-agnostic component that renders a page based on JSON schema.
 */
export function PageRenderer({ schema, pageName }: PageRendererProps) {
  if (!schema) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">No page schema provided</div>
      </div>
    );
  }

  return (
    <div className="page-renderer h-full p-4">
      <h1 className="mb-4 text-2xl font-bold">
        {schema.title || pageName || 'Page'}
      </h1>
      {/* TODO: Integrate with actual SchemaRenderer for page */}
      <div className="text-muted-foreground">
        Page rendering: {schema.title || pageName}
      </div>
    </div>
  );
}
