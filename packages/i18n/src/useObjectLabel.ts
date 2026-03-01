/**
 * @object-ui/i18n - Convention-based Object & Field Label i18n
 *
 * Provides automatic translation resolution for object metadata labels
 * using Salesforce-style convention-based key generation.
 *
 * Convention Rules:
 * | What               | Auto-generated key                        | Fallback              |
 * |--------------------|-------------------------------------------|-----------------------|
 * | Object label       | crm.objects.{objectName}.label             | objectDef.label       |
 * | Object description | crm.objects.{objectName}.description       | objectDef.description |
 * | Field label        | crm.fields.{objectName}.{fieldName}        | field.label           |
 *
 * @module useObjectLabel
 */

import { useObjectTranslation } from './provider';

/**
 * Hook for convention-based auto-resolution of object and field labels.
 *
 * Automatically constructs i18n keys from object/field names and looks up
 * translations, falling back to the plain-string label when no translation exists.
 *
 * @example
 * ```tsx
 * const { objectLabel, fieldLabel } = useObjectLabel();
 * <h1>{objectLabel(objectDef)}</h1>
 * ```
 */
export function useObjectLabel() {
  const { t } = useObjectTranslation();

  return {
    /**
     * Resolve translated object label, falling back to objectDef.label.
     */
    objectLabel: (objectDef: { name: string; label: string }) => {
      const key = `crm.objects.${objectDef.name}.label`;
      const translated = t(key, { defaultValue: '' });
      return (translated && translated !== key && translated !== '')
        ? translated
        : objectDef.label;
    },

    /**
     * Resolve translated object description, falling back to objectDef.description.
     */
    objectDescription: (objectDef: { name: string; description?: string }) => {
      if (!objectDef.description) return undefined;
      const key = `crm.objects.${objectDef.name}.description`;
      const translated = t(key, { defaultValue: '' });
      return (translated && translated !== key && translated !== '')
        ? translated
        : objectDef.description;
    },

    /**
     * Resolve translated field label, falling back to the provided fallback string.
     */
    fieldLabel: (objectName: string, fieldName: string, fallback: string) => {
      const key = `crm.fields.${objectName}.${fieldName}`;
      const translated = t(key, { defaultValue: '' });
      return (translated && translated !== key && translated !== '')
        ? translated
        : fallback;
    },
  };
}
