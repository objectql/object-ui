/**
 * EditAppPage
 *
 * Console page that reuses AppCreationWizard in edit mode.
 * Loads the existing app configuration as `initialDraft` and
 * updates the app on completion.
 * @module
 */

import { useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppCreationWizard } from '@object-ui/plugin-designer';
import { wizardDraftToAppSchema } from '@object-ui/types';
import type { AppWizardDraft, ObjectSelection } from '@object-ui/types';
import { useMetadata } from '../context/MetadataProvider';
import { useAdapter } from '../context/AdapterProvider';
import { toast } from 'sonner';

export function EditAppPage() {
  const navigate = useNavigate();
  const { appName, editAppName } = useParams();
  const { apps, objects, refresh } = useMetadata();
  const adapter = useAdapter();

  const targetAppName = editAppName || appName;

  // Find the app to edit
  const appToEdit = apps.find((a: any) => a.name === targetAppName);

  // Map metadata objects to ObjectSelection format
  const availableObjects: ObjectSelection[] = (objects || []).map((obj: any) => ({
    name: obj.name,
    label: obj.label || obj.name,
    icon: obj.icon,
    selected: appToEdit?.navigation?.some(
      (nav: any) => nav.type === 'object' && nav.objectName === obj.name,
    ) ?? false,
  }));

  // Convert existing app to wizard draft
  const initialDraft = useMemo((): Partial<AppWizardDraft> | undefined => {
    if (!appToEdit) return undefined;
    return {
      name: appToEdit.name,
      title: appToEdit.title || appToEdit.label || '',
      description: appToEdit.description || '',
      icon: appToEdit.icon || '',
      layout: appToEdit.layout || 'sidebar',
      navigation: appToEdit.navigation || [],
      branding: {
        logo: appToEdit.branding?.logo || appToEdit.logo || '',
        primaryColor: appToEdit.branding?.primaryColor || '#3b82f6',
        favicon: appToEdit.branding?.favicon || appToEdit.favicon || '',
      },
    };
  }, [appToEdit]);

  const handleComplete = useCallback(
    async (draft: AppWizardDraft) => {
      try {
        const appSchema = wizardDraftToAppSchema(draft);
        // Persist app metadata to backend
        const client = adapter?.getClient();
        if (client) {
          await client.meta.saveItem('app', draft.name, appSchema);
        }
        toast.success(`Application "${draft.title}" updated successfully`);
        await refresh?.();
        navigate(`/apps/${draft.name}`);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to update application');
      }
    },
    [navigate, refresh, adapter],
  );

  const handleCancel = useCallback(() => {
    if (appName) {
      navigate(`/apps/${appName}`);
    } else {
      navigate('/');
    }
  }, [navigate, appName]);

  const handleSaveDraft = useCallback((draft: AppWizardDraft) => {
    try {
      localStorage.setItem(`objectui-edit-draft-${targetAppName}`, JSON.stringify(draft));
      toast.info('Draft saved');
    } catch {
      // localStorage full
    }
  }, [targetAppName]);

  if (!appToEdit) {
    return (
      <div className="mx-auto max-w-4xl py-8 px-4 text-center" data-testid="edit-app-not-found">
        <p className="text-muted-foreground">Application &quot;{targetAppName}&quot; not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl py-8 px-4" data-testid="edit-app-page">
      <AppCreationWizard
        availableObjects={availableObjects}
        initialDraft={initialDraft}
        onComplete={handleComplete}
        onCancel={handleCancel}
        onSaveDraft={handleSaveDraft}
      />
    </div>
  );
}
