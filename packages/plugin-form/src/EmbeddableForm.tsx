/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * EmbeddableForm Component
 *
 * A standalone embeddable form that can be accessed without authentication.
 * Designed for external data collection use cases (surveys, registrations, etc.).
 *
 * Features:
 * - Renders from ObjectFormSchema or inline field definitions
 * - No authentication required (public access)
 * - URL prefill parameters support (?name=John&email=...)
 * - Configurable branding (logo, colors, title)
 * - Success/thank-you page after submission
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { DataSource, FormField } from '@object-ui/types';
import { ObjectForm } from './ObjectForm';

export interface EmbeddableFormConfig {
  /** Unique form ID */
  formId: string;
  /** Object name to create records in */
  objectName: string;
  /** Form title displayed at the top */
  title?: string;
  /** Form description / instructions */
  description?: string;
  /** Fields to include in the form (subset of object fields) */
  fields?: string[];
  /** Custom field definitions for inline forms */
  customFields?: FormField[];
  /** Branding configuration */
  branding?: {
    logo?: string;
    primaryColor?: string;
    backgroundColor?: string;
  };
  /** Thank you page configuration */
  thankYouPage?: {
    title?: string;
    message?: string;
    redirectUrl?: string;
    redirectDelay?: number;
  };
  /** Allow multiple submissions */
  allowMultiple?: boolean;
}

export interface EmbeddableFormProps {
  /** Form configuration */
  config: EmbeddableFormConfig;
  /** Data source for creating records */
  dataSource?: DataSource;
  /** URL search parameters for prefilling fields */
  prefillParams?: Record<string, string>;
  /** Additional CSS class */
  className?: string;
}

/**
 * EmbeddableForm — Standalone form for external data collection.
 *
 * Can be rendered at a public URL (e.g., `/forms/:formId`) without auth.
 * Submissions create records in the specified object via DataSource.
 */
export const EmbeddableForm: React.FC<EmbeddableFormProps> = ({
  config,
  dataSource,
  prefillParams,
  className,
}) => {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build initial data from URL prefill params or window.location.search
  const initialData = useMemo(() => {
    const data: Record<string, string> = {};
    // Explicit prefillParams take priority
    if (prefillParams) {
      for (const [key, value] of Object.entries(prefillParams)) {
        data[key] = value;
      }
    }
    // Also parse URL search parameters for prefilling (Phase 14 L2)
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      urlParams.forEach((value, key) => {
        if (!(key in data)) {
          data[key] = value;
        }
      });
    }
    return Object.keys(data).length > 0 ? data : undefined;
  }, [prefillParams]);

  const handleSubmit = useCallback(async (formData: Record<string, any>) => {
    setSubmitting(true);
    setError(null);

    try {
      if (dataSource) {
        await dataSource.create(config.objectName, formData);
      }
      setSubmitted(true);

      // Handle redirect after delay
      if (config.thankYouPage?.redirectUrl) {
        const delay = config.thankYouPage.redirectDelay ?? 3000;
        setTimeout(() => {
          window.location.href = config.thankYouPage!.redirectUrl!;
        }, delay);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit form. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [dataSource, config]);

  const handleReset = useCallback(() => {
    setSubmitted(false);
    setError(null);
  }, []);

  // Branding styles
  const brandingStyle = useMemo(() => {
    const style: React.CSSProperties = {};
    if (config.branding?.backgroundColor) {
      style.backgroundColor = config.branding.backgroundColor;
    }
    return style;
  }, [config.branding]);

  // Thank you page
  if (submitted) {
    const thankYou = config.thankYouPage;
    return (
      <div
        className={`min-h-screen flex items-center justify-center p-4 ${className || ''}`}
        style={brandingStyle}
      >
        <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-8 text-center space-y-4">
          <div className="text-4xl">✓</div>
          <h2 className="text-xl font-semibold text-foreground">
            {thankYou?.title || 'Thank You!'}
          </h2>
          <p className="text-muted-foreground">
            {thankYou?.message || 'Your submission has been received successfully.'}
          </p>
          {config.allowMultiple && (
            <button
              onClick={handleReset}
              className="mt-4 px-4 py-2 text-sm font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              Submit Another Response
            </button>
          )}
          {thankYou?.redirectUrl && (
            <p className="text-xs text-muted-foreground">
              Redirecting in {Math.ceil((thankYou.redirectDelay ?? 3000) / 1000)} seconds...
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 ${className || ''}`}
      style={brandingStyle}
    >
      <div className="max-w-2xl w-full bg-card rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div
          className="p-6 border-b"
          style={config.branding?.primaryColor ? { borderBottomColor: config.branding.primaryColor } : undefined}
        >
          {config.branding?.logo && (
            <img
              src={config.branding.logo}
              alt="Logo"
              className="h-8 mb-4"
            />
          )}
          {config.title && (
            <h1 className="text-xl font-semibold text-foreground">
              {config.title}
            </h1>
          )}
          {config.description && (
            <p className="text-sm text-muted-foreground mt-1">
              {config.description}
            </p>
          )}
        </div>

        {/* Form body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive">
              {error}
            </div>
          )}
          <ObjectForm
            schema={{
              type: 'object-form',
              objectName: config.objectName,
              mode: 'create',
              fields: config.fields,
              customFields: config.customFields,
              initialData,
              onSuccess: handleSubmit,
              submitLabel: submitting ? 'Submitting...' : 'Submit',
            }}
            dataSource={dataSource}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t bg-muted/20 text-center">
          <p className="text-xs text-muted-foreground">
            Powered by ObjectStack
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmbeddableForm;
