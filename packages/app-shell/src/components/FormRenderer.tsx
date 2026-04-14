import { SchemaRendererProvider } from '@object-ui/react';
import type { FormRendererProps } from '../types';

/**
 * FormRenderer - Renders forms (modal or inline)
 *
 * Framework-agnostic component that renders a form based on schema.
 * Handles both create and edit modes.
 */
export function FormRenderer({
  schema,
  dataSource,
  mode = 'create',
  recordId,
  onSuccess,
  onCancel,
  objectDef,
}: FormRendererProps) {
  if (!schema) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-muted-foreground">No form schema provided</div>
      </div>
    );
  }

  const handleSubmit = async (data: any) => {
    try {
      if (mode === 'create' && objectDef) {
        const result = await dataSource.create(objectDef.name, data);
        onSuccess?.(result);
      } else if (mode === 'edit' && recordId && objectDef) {
        const result = await dataSource.update(objectDef.name, recordId, data);
        onSuccess?.(result);
      }
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  return (
    <SchemaRendererProvider dataSource={dataSource}>
      <div className="form-renderer p-4">
        <h2 className="mb-4 text-xl font-semibold">
          {schema.title || (mode === 'create' ? 'Create Record' : 'Edit Record')}
        </h2>
        {/* TODO: Integrate with actual form renderer */}
        <div className="text-muted-foreground">
          Form rendering in {mode} mode
          {recordId && ` for record ${recordId}`}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => handleSubmit({})}
            className="rounded bg-primary px-4 py-2 text-primary-foreground"
          >
            Save
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              className="rounded border px-4 py-2"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </SchemaRendererProvider>
  );
}
