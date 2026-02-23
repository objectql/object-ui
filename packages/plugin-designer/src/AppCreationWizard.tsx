/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * AppCreationWizard Component
 *
 * Multi-step wizard for creating applications following the Airtable
 * Interface Designer UX pattern. Steps:
 * 1. Basic Info (name, title, description, icon, template, layout)
 * 2. Object Selection (select business objects to include)
 * 3. Navigation Builder (build navigation tree from selected objects)
 * 4. Branding (logo, primary color, favicon)
 */

import React, { useState, useCallback, useMemo } from 'react';
import type {
  AppWizardDraft,
  AppWizardStep,
  BrandingConfig,
  ObjectSelection,
  NavigationItem,
} from '@object-ui/types';
import { isValidAppName } from '@object-ui/types';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Search,
  Plus,
  Trash2,
  Layout,
  PanelLeft,
  LayoutTemplate,
  FolderOpen,
  Link,
  Minus,
  Image,
  Palette,
  Globe,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useDesignerTranslation } from './hooks/useDesignerTranslation';
import { useConfirmDialog } from './hooks/useConfirmDialog';

function cn(...inputs: (string | undefined | false)[]) {
  return twMerge(clsx(inputs));
}

// ============================================================================
// Types
// ============================================================================

export interface AppCreationWizardProps {
  /** Available business objects to select from */
  availableObjects?: ObjectSelection[];
  /** Available templates */
  templates?: Array<{ id: string; label: string; description?: string }>;
  /** Initial draft state (for editing existing apps) */
  initialDraft?: Partial<AppWizardDraft>;
  /** Callback when wizard completes */
  onComplete?: (draft: AppWizardDraft) => void;
  /** Callback when wizard is cancelled */
  onCancel?: () => void;
  /** Callback to save draft (partial progress) */
  onSaveDraft?: (draft: AppWizardDraft) => void;
  /** Read-only mode */
  readOnly?: boolean;
  /** CSS class */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_DRAFT: AppWizardDraft = {
  name: '',
  title: '',
  description: '',
  icon: '',
  template: '',
  layout: 'sidebar',
  objects: [],
  navigation: [],
  branding: {
    logo: '',
    primaryColor: '#3b82f6',
    favicon: '',
  },
};

// ============================================================================
// Helpers
// ============================================================================

function generateNavFromObjects(objects: ObjectSelection[]): NavigationItem[] {
  return objects
    .filter((o) => o.selected)
    .map((o) => ({
      id: o.name,
      type: 'object' as const,
      label: o.label,
      icon: o.icon,
      objectName: o.name,
    }));
}

let navItemCounter = 0;

function createNavId(prefix: string): string {
  navItemCounter += 1;
  return `${prefix}_${Date.now()}_${navItemCounter}`;
}

// ============================================================================
// Step Indicator
// ============================================================================

interface StepIndicatorProps {
  steps: AppWizardStep[];
  currentIndex: number;
  onStepClick: (index: number) => void;
}

function StepIndicator({ steps, currentIndex, onStepClick }: StepIndicatorProps) {
  return (
    <nav className="flex items-center justify-center gap-0 px-4 py-6">
      {steps.map((step, i) => {
        const isCompleted = i < currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <React.Fragment key={step.id}>
            {i > 0 && (
              <div
                className={cn(
                  'h-0.5 w-12 sm:w-20',
                  isCompleted ? 'bg-blue-500' : 'bg-gray-200'
                )}
              />
            )}
            <button
              type="button"
              data-testid={`wizard-step-${step.id}`}
              onClick={() => onStepClick(i)}
              className={cn(
                'flex flex-col items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-lg px-2 py-1',
                isCurrent && 'cursor-default',
                !isCurrent && 'cursor-pointer'
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                  isCompleted && 'bg-blue-500 text-white',
                  isCurrent && 'bg-blue-600 text-white ring-2 ring-blue-300',
                  !isCompleted && !isCurrent && 'bg-gray-200 text-gray-500'
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  'text-xs font-medium',
                  isCurrent ? 'text-blue-600' : 'text-gray-500'
                )}
              >
                {step.label}
              </span>
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}

// ============================================================================
// Step 1: Basic Info
// ============================================================================

interface BasicInfoStepProps {
  draft: AppWizardDraft;
  templates: Array<{ id: string; label: string; description?: string }>;
  readOnly: boolean;
  onChange: (partial: Partial<AppWizardDraft>) => void;
  t: (key: string) => string;
}

function BasicInfoStep({ draft, templates, readOnly, onChange, t }: BasicInfoStepProps) {
  const nameError = draft.name.length > 0 && !isValidAppName(draft.name);

  return (
    <div data-testid="wizard-step-basic-content" className="mx-auto max-w-lg space-y-5">
      {/* Name */}
      <div className="space-y-1.5">
        <label htmlFor="app-name" className="block text-sm font-medium text-gray-700">
          {t('appDesigner.appName')} <span className="text-red-500">*</span>
        </label>
        <input
          id="app-name"
          data-testid="app-name-input"
          type="text"
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="my_app"
          disabled={readOnly}
          className={cn(
            'block w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none transition-colors',
            'focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
            'disabled:cursor-not-allowed disabled:bg-gray-50',
            nameError ? 'border-red-400' : 'border-gray-300'
          )}
        />
        {nameError && (
          <p className="text-xs text-red-500">{t('appDesigner.snakeCaseHint')}</p>
        )}
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <label htmlFor="app-title" className="block text-sm font-medium text-gray-700">
          {t('appDesigner.appTitle')} <span className="text-red-500">*</span>
        </label>
        <input
          id="app-title"
          data-testid="app-title-input"
          type="text"
          value={draft.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="My Application"
          disabled={readOnly}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50"
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label htmlFor="app-description" className="block text-sm font-medium text-gray-700">
          {t('appDesigner.appDescription')}
        </label>
        <textarea
          id="app-description"
          data-testid="app-description-input"
          value={draft.description ?? ''}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={3}
          disabled={readOnly}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 resize-none"
        />
      </div>

      {/* Icon */}
      <div className="space-y-1.5">
        <label htmlFor="app-icon" className="block text-sm font-medium text-gray-700">
          {t('appDesigner.appIcon')}
        </label>
        <input
          id="app-icon"
          type="text"
          value={draft.icon ?? ''}
          onChange={(e) => onChange({ icon: e.target.value })}
          placeholder="LayoutDashboard"
          disabled={readOnly}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50"
        />
      </div>

      {/* Template */}
      {templates.length > 0 && (
        <div className="space-y-1.5">
          <label htmlFor="app-template" className="block text-sm font-medium text-gray-700">
            {t('appDesigner.template')}
          </label>
          <select
            id="app-template"
            value={draft.template ?? ''}
            onChange={(e) => onChange({ template: e.target.value })}
            disabled={readOnly}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50"
          >
            <option value="">None</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Layout */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-700">{t('appDesigner.layout')}</legend>
        <div className="flex gap-3">
          {([
            { value: 'sidebar', labelKey: 'appDesigner.layoutSidebar', Icon: PanelLeft },
            { value: 'header', labelKey: 'appDesigner.layoutHeader', Icon: Layout },
            { value: 'empty', labelKey: 'appDesigner.layoutEmpty', Icon: LayoutTemplate },
          ] as const).map(({ value, labelKey, Icon }) => (
            <label
              key={value}
              data-testid={`app-layout-${value}`}
              className={cn(
                'flex flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-colors',
                draft.layout === value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300',
                readOnly && 'pointer-events-none opacity-60'
              )}
            >
              <Icon className="h-5 w-5 text-gray-600" />
              <span className="text-xs font-medium text-gray-700">{t(labelKey)}</span>
              <input
                type="radio"
                name="layout"
                value={value}
                checked={draft.layout === value}
                onChange={() => onChange({ layout: value })}
                disabled={readOnly}
                className="sr-only"
              />
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

// ============================================================================
// Step 2: Object Selection
// ============================================================================

interface ObjectSelectionStepProps {
  objects: ObjectSelection[];
  readOnly: boolean;
  onToggle: (name: string) => void;
  onToggleAll: (selected: boolean) => void;
  search: string;
  onSearchChange: (value: string) => void;
  t: (key: string) => string;
}

function ObjectSelectionStep({
  objects,
  readOnly,
  onToggle,
  onToggleAll,
  search,
  onSearchChange,
  t,
}: ObjectSelectionStepProps) {
  const filtered = useMemo(() => {
    if (!search) return objects;
    const lower = search.toLowerCase();
    return objects.filter(
      (o) =>
        o.name.toLowerCase().includes(lower) || o.label.toLowerCase().includes(lower)
    );
  }, [objects, search]);

  const allSelected = objects.length > 0 && objects.every((o) => o.selected);
  const noneSelected = objects.every((o) => !o.selected);

  return (
    <div data-testid="wizard-step-objects-content" className="mx-auto max-w-2xl space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <input
            data-testid="object-search"
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('appDesigner.searchObjects')}
            className="block w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button
          type="button"
          onClick={() => onToggleAll(!allSelected)}
          disabled={readOnly}
          className="rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {allSelected ? t('appDesigner.deselectAll') : t('appDesigner.selectAll')}
        </button>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">{t('appDesigner.noObjectsFound')}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((obj) => (
            <button
              key={obj.name}
              type="button"
              data-testid={`object-card-${obj.name}`}
              disabled={readOnly}
              onClick={() => onToggle(obj.name)}
              className={cn(
                'flex flex-col items-start gap-1 rounded-lg border-2 p-3 text-left transition-colors',
                obj.selected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300',
                readOnly && 'pointer-events-none opacity-60'
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-sm font-medium text-gray-800">{obj.label}</span>
                <div
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded border transition-colors',
                    obj.selected
                      ? 'border-blue-500 bg-blue-500 text-white'
                      : 'border-gray-300'
                  )}
                >
                  {obj.selected && <Check className="h-3 w-3" />}
                </div>
              </div>
              <span className="text-xs text-gray-500">{obj.name}</span>
              {obj.icon && <span className="text-xs text-gray-400">{obj.icon}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Step 3: Navigation Builder
// ============================================================================

interface NavigationBuilderStepProps {
  items: NavigationItem[];
  readOnly: boolean;
  onAdd: (type: 'group' | 'url' | 'separator') => void;
  onRemove: (id: string) => void;
  onReorder: (id: string, direction: 'up' | 'down') => void;
  t: (key: string) => string;
}

const TYPE_BADGE_COLORS: Record<string, string> = {
  object: 'bg-green-100 text-green-700',
  group: 'bg-purple-100 text-purple-700',
  url: 'bg-sky-100 text-sky-700',
  separator: 'bg-gray-100 text-gray-600',
  dashboard: 'bg-amber-100 text-amber-700',
  page: 'bg-teal-100 text-teal-700',
  report: 'bg-rose-100 text-rose-700',
  action: 'bg-orange-100 text-orange-700',
};

function NavigationBuilderStep({
  items,
  readOnly,
  onAdd,
  onRemove,
  onReorder,
  t,
}: NavigationBuilderStepProps) {
  return (
    <div data-testid="wizard-step-navigation-content" className="mx-auto max-w-lg space-y-4">
      {/* Add buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          data-testid="add-group-btn"
          onClick={() => onAdd('group')}
          disabled={readOnly}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          {t('appDesigner.addGroup')}
        </button>
        <button
          type="button"
          data-testid="add-url-btn"
          onClick={() => onAdd('url')}
          disabled={readOnly}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Link className="h-3.5 w-3.5" />
          {t('appDesigner.addUrl')}
        </button>
        <button
          type="button"
          data-testid="add-separator-btn"
          onClick={() => onAdd('separator')}
          disabled={readOnly}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Minus className="h-3.5 w-3.5" />
          {t('appDesigner.addSeparator')}
        </button>
      </div>

      {/* Item list */}
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">
          {t('appDesigner.noNavItemsHint')}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item, idx) => (
            <li
              key={item.id}
              data-testid={`nav-item-${item.id}`}
              className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2"
            >
              {item.icon && (
                <span className="text-xs text-gray-400">{item.icon}</span>
              )}
              <span className="flex-1 truncate text-sm text-gray-800">
                {item.type === 'separator' ? t('appDesigner.separatorLabel') : item.label}
              </span>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-medium',
                  TYPE_BADGE_COLORS[item.type] ?? 'bg-gray-100 text-gray-600'
                )}
              >
                {item.type}
              </span>

              {/* Reorder / Remove */}
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onReorder(item.id, 'up')}
                  disabled={readOnly || idx === 0}
                  className="rounded p-0.5 text-gray-400 transition-colors hover:text-gray-700 disabled:opacity-30"
                  aria-label="Move up"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onReorder(item.id, 'down')}
                  disabled={readOnly || idx === items.length - 1}
                  className="rounded p-0.5 text-gray-400 transition-colors hover:text-gray-700 disabled:opacity-30"
                  aria-label="Move down"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  disabled={readOnly}
                  className="rounded p-0.5 text-gray-400 transition-colors hover:text-red-500 disabled:opacity-30"
                  aria-label="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================================
// Step 4: Branding
// ============================================================================

interface BrandingStepProps {
  branding: BrandingConfig;
  title: string;
  readOnly: boolean;
  onChange: (partial: Partial<BrandingConfig>) => void;
  t: (key: string) => string;
}

function BrandingStep({ branding, title, readOnly, onChange, t }: BrandingStepProps) {
  return (
    <div data-testid="wizard-step-branding-content" className="mx-auto max-w-lg space-y-5">
      {/* Logo URL */}
      <div className="space-y-1.5">
        <label htmlFor="branding-logo" className="block text-sm font-medium text-gray-700">
          {t('appDesigner.logoUrl')}
        </label>
        <div className="relative">
          <Image className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <input
            id="branding-logo"
            data-testid="branding-logo-input"
            type="text"
            value={branding.logo ?? ''}
            onChange={(e) => onChange({ logo: e.target.value })}
            placeholder="https://example.com/logo.svg"
            disabled={readOnly}
            className="block w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50"
          />
        </div>
      </div>

      {/* Primary Color */}
      <div className="space-y-1.5">
        <label htmlFor="branding-color" className="block text-sm font-medium text-gray-700">
          {t('appDesigner.primaryColor')}
        </label>
        <div className="relative">
          <Palette className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <input
            id="branding-color"
            data-testid="branding-color-input"
            type="text"
            value={branding.primaryColor ?? '#3b82f6'}
            onChange={(e) => onChange({ primaryColor: e.target.value })}
            placeholder="#3b82f6"
            disabled={readOnly}
            className="block w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50"
          />
        </div>
      </div>

      {/* Favicon URL */}
      <div className="space-y-1.5">
        <label htmlFor="branding-favicon" className="block text-sm font-medium text-gray-700">
          {t('appDesigner.faviconUrl')}
        </label>
        <div className="relative">
          <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <input
            id="branding-favicon"
            data-testid="branding-favicon-input"
            type="text"
            value={branding.favicon ?? ''}
            onChange={(e) => onChange({ favicon: e.target.value })}
            placeholder="https://example.com/favicon.ico"
            disabled={readOnly}
            className="block w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50"
          />
        </div>
      </div>

      {/* Branding Preview */}
      <div className="space-y-1.5">
        <span className="block text-sm font-medium text-gray-700">{t('appDesigner.preview')}</span>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-3">
            {branding.logo ? (
              <img
                src={branding.logo}
                alt="App logo"
                className="h-8 w-8 rounded object-contain"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-100 text-xs text-gray-400">
                Logo
              </div>
            )}
            <span className="text-sm font-semibold text-gray-800">{title || t('appDesigner.appTitle')}</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div
              className="h-4 w-4 rounded-full border border-gray-200"
              style={{ backgroundColor: branding.primaryColor || '#3b82f6' }}
            />
            <span className="text-xs text-gray-500">
              {branding.primaryColor || '#3b82f6'}
            </span>
          </div>
          {branding.favicon && (
            <div className="mt-2 flex items-center gap-2">
              <img
                src={branding.favicon}
                alt="Favicon"
                className="h-4 w-4 rounded object-contain"
              />
              <span className="text-xs text-gray-500">Favicon</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Wizard Component
// ============================================================================

export function AppCreationWizard({
  availableObjects = [],
  templates = [],
  initialDraft,
  onComplete,
  onCancel,
  onSaveDraft,
  readOnly = false,
  className,
}: AppCreationWizardProps) {
  // ---- i18n ----
  const { t } = useDesignerTranslation();

  // ---- Confirm dialog for cancel ----
  const confirmDialog = useConfirmDialog();

  // ---- State ----
  const [currentStep, setCurrentStep] = useState(0);
  const [objectSearch, setObjectSearch] = useState('');

  const [draft, setDraft] = useState<AppWizardDraft>(() => ({
    ...DEFAULT_DRAFT,
    objects: availableObjects.map((o) => ({ ...o })),
    ...initialDraft,
  }));

  // ---- i18n-aware step definitions ----
  const wizardSteps = useMemo<AppWizardStep[]>(() => [
    { id: 'basic', label: t('appDesigner.basicInfo'), description: t('appDesigner.stepBasicDesc'), icon: 'Settings' },
    { id: 'objects', label: t('appDesigner.objects'), description: t('appDesigner.stepObjectsDesc'), icon: 'Database' },
    { id: 'navigation', label: t('appDesigner.navigation'), description: t('appDesigner.stepNavigationDesc'), icon: 'Menu' },
    { id: 'branding', label: t('appDesigner.branding'), description: t('appDesigner.stepBrandingDesc'), icon: 'Palette' },
  ], [t]);

  // ---- Derived ----
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === wizardSteps.length - 1;

  const step1Valid = useMemo(
    () => draft.name.length > 0 && isValidAppName(draft.name) && draft.title.trim().length > 0,
    [draft.name, draft.title]
  );

  const canProceed = useMemo(() => {
    if (currentStep === 0) return step1Valid;
    return true;
  }, [currentStep, step1Valid]);

  // ---- Callbacks ----
  const updateDraft = useCallback((partial: Partial<AppWizardDraft>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  }, []);

  const updateBranding = useCallback((partial: Partial<BrandingConfig>) => {
    setDraft((prev) => ({
      ...prev,
      branding: { ...prev.branding, ...partial },
    }));
  }, []);

  const toggleObject = useCallback((name: string) => {
    setDraft((prev) => ({
      ...prev,
      objects: prev.objects.map((o) =>
        o.name === name ? { ...o, selected: !o.selected } : o
      ),
    }));
  }, []);

  const toggleAllObjects = useCallback((selected: boolean) => {
    setDraft((prev) => ({
      ...prev,
      objects: prev.objects.map((o) => ({ ...o, selected })),
    }));
  }, []);

  const addNavItem = useCallback((type: 'group' | 'url' | 'separator') => {
    const newItem: NavigationItem = {
      id: createNavId(type),
      type,
      label: type === 'separator' ? '' : type === 'group' ? 'New Group' : 'New Link',
      ...(type === 'group' ? { children: [] } : {}),
      ...(type === 'url' ? { url: '' } : {}),
    };
    setDraft((prev) => ({
      ...prev,
      navigation: [...prev.navigation, newItem],
    }));
  }, []);

  const removeNavItem = useCallback((id: string) => {
    setDraft((prev) => ({
      ...prev,
      navigation: prev.navigation.filter((item) => item.id !== id),
    }));
  }, []);

  const reorderNavItem = useCallback((id: string, direction: 'up' | 'down') => {
    setDraft((prev) => {
      const items = [...prev.navigation];
      const idx = items.findIndex((item) => item.id === id);
      if (idx < 0) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= items.length) return prev;
      [items[idx], items[targetIdx]] = [items[targetIdx], items[idx]];
      return { ...prev, navigation: items };
    });
  }, []);

  const handleNext = useCallback(() => {
    if (isLastStep) return;
    // Auto-generate navigation when moving from objects → navigation
    if (currentStep === 1) {
      setDraft((prev) => ({
        ...prev,
        navigation: generateNavFromObjects(prev.objects),
      }));
    }
    setCurrentStep((s) => s + 1);
  }, [currentStep, isLastStep]);

  const handleBack = useCallback(() => {
    if (isFirstStep) return;
    setCurrentStep((s) => s - 1);
  }, [isFirstStep]);

  const handleComplete = useCallback(() => {
    onComplete?.(draft);
  }, [draft, onComplete]);

  const handleCancel = useCallback(async () => {
    // If there are any changes (name or title filled), show confirmation
    const hasChanges = draft.name.length > 0 || draft.title.length > 0;
    if (hasChanges && onCancel) {
      const confirmed = await confirmDialog.confirm(
        t('appDesigner.cancelConfirmTitle'),
        t('appDesigner.cancelConfirmMessage'),
      );
      if (confirmed) onCancel();
    } else {
      onCancel?.();
    }
  }, [draft.name, draft.title, onCancel, confirmDialog, t]);

  const handleSaveDraft = useCallback(() => {
    onSaveDraft?.(draft);
  }, [draft, onSaveDraft]);

  const handleStepClick = useCallback(
    (index: number) => {
      // Only allow navigating to completed steps or the next valid step
      if (index <= currentStep) {
        setCurrentStep(index);
      } else if (index === currentStep + 1 && canProceed) {
        // Auto-generate navigation when jumping from objects → navigation
        if (currentStep === 1 && index === 2) {
          setDraft((prev) => ({
            ...prev,
            navigation: generateNavFromObjects(prev.objects),
          }));
        }
        setCurrentStep(index);
      }
    },
    [currentStep, canProceed]
  );

  // ---- Render ----
  return (
    <div className={cn('flex h-full flex-col rounded-xl border border-gray-200 bg-white shadow-sm', className)}>
      {/* Cancel Confirmation Dialog */}
      {confirmDialog.isOpen && (
        <div
          data-testid="cancel-confirm-dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
        >
          <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <h3 className="text-base font-semibold text-gray-900">{confirmDialog.title}</h3>
              <button
                type="button"
                onClick={confirmDialog.onCancel}
                className="rounded p-1 text-gray-400 hover:text-gray-600"
                aria-label={t('common.close')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-600">{confirmDialog.message}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                data-testid="cancel-confirm-keep"
                onClick={confirmDialog.onCancel}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                {t('appDesigner.keepEditing')}
              </button>
              <button
                type="button"
                data-testid="cancel-confirm-discard"
                onClick={confirmDialog.onConfirm}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                {t('appDesigner.confirmDiscard')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step Indicator */}
      <div className="border-b border-gray-100">
        <StepIndicator
          steps={wizardSteps}
          currentIndex={currentStep}
          onStepClick={handleStepClick}
        />
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {currentStep === 0 && (
          <BasicInfoStep
            draft={draft}
            templates={templates}
            readOnly={readOnly}
            onChange={updateDraft}
            t={t}
          />
        )}
        {currentStep === 1 && (
          <ObjectSelectionStep
            objects={draft.objects}
            readOnly={readOnly}
            onToggle={toggleObject}
            onToggleAll={toggleAllObjects}
            search={objectSearch}
            onSearchChange={setObjectSearch}
            t={t}
          />
        )}
        {currentStep === 2 && (
          <NavigationBuilderStep
            items={draft.navigation}
            readOnly={readOnly}
            onAdd={addNavItem}
            onRemove={removeNavItem}
            onReorder={reorderNavItem}
            t={t}
          />
        )}
        {currentStep === 3 && (
          <BrandingStep
            branding={draft.branding}
            title={draft.title}
            readOnly={readOnly}
            onChange={updateBranding}
            t={t}
          />
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="wizard-cancel"
            onClick={handleCancel}
            disabled={readOnly}
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          {onSaveDraft && (
            <button
              type="button"
              data-testid="wizard-save-draft"
              onClick={handleSaveDraft}
              disabled={readOnly}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('appDesigner.saveDraft')}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isFirstStep && (
            <button
              type="button"
              data-testid="wizard-back"
              onClick={handleBack}
              disabled={readOnly}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              {t('common.back')}
            </button>
          )}
          {isLastStep ? (
            <button
              type="button"
              data-testid="wizard-complete"
              onClick={handleComplete}
              disabled={readOnly || !canProceed}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {t('appDesigner.complete')}
            </button>
          ) : (
            <button
              type="button"
              data-testid="wizard-next"
              onClick={handleNext}
              disabled={readOnly || !canProceed}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('common.next')}
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
