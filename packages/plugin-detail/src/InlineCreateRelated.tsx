/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import {
  cn,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@object-ui/components';
import { Plus, Link, Search, X, Loader2 } from 'lucide-react';

export interface RelatedFieldDefinition {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  required?: boolean;
  placeholder?: string;
}

export interface RelatedRecordOption {
  id: string;
  label: string;
  description?: string;
}

export interface InlineCreateRelatedProps {
  objectName: string;
  relationshipField: string;
  fields: RelatedFieldDefinition[];
  onCreateRecord?: (values: Record<string, any>) => void | Promise<void>;
  onLinkRecord?: (recordId: string) => void | Promise<void>;
  onSearch?: (query: string) => Promise<RelatedRecordOption[]>;
  existingRecords?: RelatedRecordOption[];
  className?: string;
}

export const InlineCreateRelated: React.FC<InlineCreateRelatedProps> = ({
  objectName,
  relationshipField,
  fields,
  onCreateRecord,
  onLinkRecord,
  onSearch,
  existingRecords = [],
  className,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<string>('create');
  const [formValues, setFormValues] = React.useState<Record<string, any>>({});
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<RelatedRecordOption[]>(existingRecords);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSearching, setIsSearching] = React.useState(false);

  /**
   * Namespace for the create-tab input ids (objectui#3341). `field.name` alone
   * is unique only WITHIN one instance — a detail page renders one of these per
   * related list, so two lists both offering a `name` field would emit
   * duplicate ids and `<label for>` would resolve to whichever came first.
   * `React.useId` supplies the per-instance half.
   */
  const instanceId = React.useId();
  const fieldDomId = React.useCallback(
    (fieldName: string) => `inline-create-${instanceId}-${fieldName}`,
    [instanceId],
  );

  /**
   * The link-tab search box (objectui#3381). Same namespacing rationale as
   * `fieldDomId`; the hyphenated `link-search` segment cannot collide with a
   * `fieldDomId(...)` suffix, which is a metadata field name (`[a-z0-9_]+`).
   */
  const searchInputId = `inline-create-${instanceId}-link-search`;
  /**
   * Single source for the search box's name: the visible-to-AT `<label>` below
   * and the placeholder are the SAME string (the placeholder only adds the
   * ellipsis). Before #3381 there was no label at all, so the accessible name
   * fell through to the placeholder — the last resort in HTML-AAM, which (a)
   * is what a real browser shows only until the user types, and (b) is not
   * implemented at all by `dom-accessibility-api`, so under test the control
   * had NO name. Keeping both strings on one expression is what stops the
   * label and the placeholder from drifting apart later.
   */
  const searchLabel = `Search ${objectName}`;

  const filteredResults = React.useMemo(() => {
    if (!searchQuery.trim()) return searchResults;
    const query = searchQuery.toLowerCase();
    return searchResults.filter(
      (r) =>
        r.label.toLowerCase().includes(query) ||
        r.description?.toLowerCase().includes(query),
    );
  }, [searchQuery, searchResults]);

  const handleSearchChange = React.useCallback(
    async (value: string) => {
      setSearchQuery(value);
      if (onSearch && value.trim().length >= 2) {
        setIsSearching(true);
        try {
          const results = await onSearch(value);
          setSearchResults(results);
        } finally {
          setIsSearching(false);
        }
      }
    },
    [onSearch],
  );

  const handleFieldChange = React.useCallback(
    (fieldName: string, value: string) => {
      setFormValues((prev) => ({ ...prev, [fieldName]: value }));
    },
    [],
  );

  const handleCreate = React.useCallback(async () => {
    if (!onCreateRecord) return;
    setIsSubmitting(true);
    try {
      await onCreateRecord({ ...formValues, [relationshipField]: true });
      setFormValues({});
      setIsOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  }, [onCreateRecord, formValues, relationshipField]);

  const handleLink = React.useCallback(
    async (recordId: string) => {
      if (!onLinkRecord) return;
      setIsSubmitting(true);
      try {
        await onLinkRecord(recordId);
        setSearchQuery('');
        setIsOpen(false);
      } finally {
        setIsSubmitting(false);
      }
    },
    [onLinkRecord],
  );

  const isCreateValid = React.useMemo(() => {
    return fields
      .filter((f) => f.required)
      .every((f) => formValues[f.name]?.toString().trim());
  }, [fields, formValues]);

  if (!isOpen) {
    return (
      <div className={cn('flex gap-2', className)}>
        {onCreateRecord && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setActiveTab('create');
              setIsOpen(true);
            }}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            New {objectName}
          </Button>
        )}
        {onLinkRecord && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setActiveTab('link');
              setIsOpen(true);
            }}
            className="gap-1.5"
          >
            <Link className="h-3.5 w-3.5" />
            Link Existing
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <span>
            {activeTab === 'create' ? 'Create' : 'Link'} {objectName}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-3 w-full">
            {onCreateRecord && (
              <TabsTrigger value="create" className="flex-1 gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Create New
              </TabsTrigger>
            )}
            {onLinkRecord && (
              <TabsTrigger value="link" className="flex-1 gap-1.5">
                <Link className="h-3.5 w-3.5" />
                Link Existing
              </TabsTrigger>
            )}
          </TabsList>

          {/* Create New Tab */}
          {onCreateRecord && (
            <TabsContent value="create" className="space-y-3 mt-0">
              {fields.map((field) => (
                <div key={field.name}>
                  <label
                    // Programmatic label→control association (objectui#3341).
                    // Without it the label text — the real field name — never
                    // reached the input's accessible name (a browser fell back
                    // to the placeholder, "Enter name"; the jsdom accname
                    // implementation has no placeholder fallback and produced
                    // an empty name — see the test header). Clicking the label
                    // also failed to focus the input.
                    htmlFor={fieldDomId(field.name)}
                    className="text-xs font-medium text-muted-foreground mb-1 block"
                  >
                    {field.label}
                    {/* Visual-only (objectui#3299): the required STATE is
                        announced via `aria-required` on the input below. */}
                    {field.required && (
                      <span className="text-destructive ml-0.5" aria-hidden="true">*</span>
                    )}
                  </label>
                  <Input
                    id={fieldDomId(field.name)}
                    // State channel for required (objectui#3299) — not the native
                    // `required` attribute, per the #3290 ruling (it would arm the
                    // browser's constraint-validation UI alongside this form's own
                    // `isCreateValid` gating).
                    aria-required={field.required || undefined}
                    type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                    placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                    value={formValues[field.name] || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={!isCreateValid || isSubmitting}
                  className="gap-1.5"
                >
                  {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Create
                </Button>
              </div>
            </TabsContent>
          )}

          {/* Link Existing Tab */}
          {onLinkRecord && (
            <TabsContent value="link" className="space-y-3 mt-0">
              <div className="relative">
                {/* Visually hidden rather than `aria-label` (objectui#3381):
                    the accessible name stays a real label element, on the same
                    expression as the placeholder, so the two cannot drift the
                    way a detached `aria-label` string does. `sr-only` is the
                    repo's existing shape for a search box whose name is carried
                    by the magnifier icon visually (see app-shell's
                    SearchResultsPage). */}
                <label htmlFor={searchInputId} className="sr-only">
                  {searchLabel}
                </label>
                {/* Decorative: the name is on the label above. lucide-react
                    already defaults childless, a11y-prop-less icons to
                    `aria-hidden`, but that is a dependency default — spelling
                    it out keeps the intent local and survives an icon-lib bump. */}
                <Search
                  aria-hidden="true"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
                />
                <Input
                  id={searchInputId}
                  placeholder={`${searchLabel}…`}
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="h-8 text-sm pl-8"
                />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {isSearching ? (
                  <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Searching…
                  </div>
                ) : filteredResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {searchQuery ? 'No records found' : 'Type to search records'}
                  </p>
                ) : (
                  filteredResults.map((record) => (
                    <button
                      key={record.id}
                      type="button"
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-accent text-sm transition-colors"
                      onClick={() => handleLink(record.id)}
                      disabled={isSubmitting}
                    >
                      <span className="font-medium">{record.label}</span>
                      {record.description && (
                        <span className="block text-xs text-muted-foreground mt-0.5">
                          {record.description}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
};
