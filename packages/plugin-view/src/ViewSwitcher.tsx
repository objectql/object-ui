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
  Tabs,
  TabsList,
  TabsTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@object-ui/components';
import { cva } from 'class-variance-authority';
import { SchemaRenderer } from '@object-ui/react';
import type { ViewSwitcherSchema, ViewType } from '@object-ui/types';
import {
  Activity,
  Calendar,
  FileText,
  GanttChartSquare,
  Grid,
  Images,
  LayoutGrid,
  List,
  Map,
  Plus,
  Share2,
  Settings,
  Copy,
  Trash2,
  icons,
  type LucideIcon,
} from 'lucide-react';

type ViewSwitcherItem = ViewSwitcherSchema['views'][number];

export type ViewSwitcherProps = {
  schema: ViewSwitcherSchema;
  className?: string;
  onViewChange?: (view: ViewType) => void;
  onCreateView?: () => void;
  onViewAction?: (action: string, view: ViewType) => void;
  createViewLabel?: string;
  [key: string]: any;
};

const DEFAULT_VIEW_LABELS: Record<ViewType, string> = {
  list: 'List',
  detail: 'Detail',
  grid: 'Grid',
  kanban: 'Kanban',
  calendar: 'Calendar',
  timeline: 'Timeline',
  map: 'Map',
  gallery: 'Gallery',
  gantt: 'Gantt',
};

const DEFAULT_VIEW_ICONS: Record<ViewType, LucideIcon> = {
  list: List,
  detail: FileText,
  grid: Grid,
  kanban: LayoutGrid,
  calendar: Calendar,
  timeline: Activity,
  map: Map,
  gallery: Images,
  gantt: GanttChartSquare,
};

const viewSwitcherLayout = cva('flex gap-4', {
  variants: {
    position: {
      top: 'flex-col',
      bottom: 'flex-col-reverse',
      left: 'flex-row',
      right: 'flex-row-reverse',
    },
  },
  defaultVariants: {
    position: 'top',
  },
});

const viewSwitcherWidth = cva('w-full', {
  variants: {
    orientation: {
      horizontal: 'w-full',
      vertical: 'w-48',
    },
  },
  defaultVariants: {
    orientation: 'horizontal',
  },
});

const viewSwitcherList = cva('flex gap-2', {
  variants: {
    orientation: {
      horizontal: 'flex-row flex-wrap',
      vertical: 'flex-col',
    },
  },
  defaultVariants: {
    orientation: 'horizontal',
  },
});

const viewSwitcherTabsList = cva('', {
  variants: {
    orientation: {
      horizontal: '',
      vertical: 'flex h-auto flex-col items-stretch',
    },
  },
  defaultVariants: {
    orientation: 'horizontal',
  },
});

function toPascalCase(str: string): string {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

const iconNameMap: Record<string, string> = {
  Home: 'House',
};

function resolveIcon(name?: string): LucideIcon | null {
  if (!name) return null;
  const iconName = toPascalCase(name);
  const mapped = iconNameMap[iconName] || iconName;
  return (icons as any)[mapped] || null;
}

function getViewLabel(view: ViewSwitcherItem): string {
  if (view.label) return view.label;
  return DEFAULT_VIEW_LABELS[view.type] || view.type;
}

function getViewIcon(view: ViewSwitcherItem): LucideIcon | null {
  if (view.icon) {
    return resolveIcon(view.icon);
  }
  return DEFAULT_VIEW_ICONS[view.type] || null;
}

function getInitialView(schema: ViewSwitcherSchema): ViewType | undefined {
  if (schema.activeView) return schema.activeView;
  if (schema.defaultView) return schema.defaultView;
  return schema.views?.[0]?.type;
}

const DEFAULT_VIEW_ACTION_ICONS: Record<string, LucideIcon> = {
  share: Share2,
  settings: Settings,
  duplicate: Copy,
  delete: Trash2,
};

const DEFAULT_VIEW_ACTION_LABELS: Record<string, string> = {
  share: 'Share',
  settings: 'Settings',
  duplicate: 'Duplicate',
  delete: 'Delete',
};

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
  schema,
  className,
  onViewChange,
  onCreateView,
  onViewAction,
  createViewLabel = 'Create view',
  ...props
}) => {
  const storageKey = React.useMemo(() => {
    if (schema.storageKey) return schema.storageKey;
    const idPart = schema.id ? `-${schema.id}` : '';
    return `view-switcher${idPart}`;
  }, [schema.id, schema.storageKey]);

  const [activeView, setActiveView] = React.useState<ViewType | undefined>(() => getInitialView(schema));

  React.useEffect(() => {
    if (schema.activeView) {
      setActiveView(schema.activeView);
      return;
    }

    if (!schema.persistPreference) return;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const view = schema.views.find(v => v.type === saved)?.type as ViewType | undefined;
        if (view) {
          setActiveView(view);
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, [schema.activeView, schema.persistPreference, schema.views, storageKey]);

  React.useEffect(() => {
    if (!schema.persistPreference || !activeView || schema.activeView) return;
    try {
      localStorage.setItem(storageKey, activeView);
    } catch {
      // Ignore storage errors
    }
  }, [activeView, schema.activeView, schema.persistPreference, storageKey]);

  const notifyChange = React.useCallback((nextView: ViewType) => {
    onViewChange?.(nextView);

    if (schema.onViewChange && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(schema.onViewChange, {
          detail: { view: nextView },
        })
      );
    }
  }, [onViewChange, schema.onViewChange]);

  const handleViewChange = React.useCallback((nextView: ViewType) => {
    setActiveView(nextView);
    notifyChange(nextView);
  }, [notifyChange]);

  const currentView = activeView || schema.views?.[0]?.type;
  const currentViewValue = currentView || '';
  const currentViewConfig = schema.views.find(v => v.type === currentView) || schema.views?.[0];

  const variant = schema.variant || 'tabs';
  const position = schema.position || 'top';
  const isVertical = position === 'left' || position === 'right';
  const orientation = isVertical ? 'vertical' : 'horizontal';

  const viewActionButtons = schema.viewActions && schema.viewActions.length > 0 ? (
    <div className="flex items-center gap-1">
      {schema.viewActions.map((action, idx) => {
        const ActionIcon = action.icon
          ? resolveIcon(action.icon) || DEFAULT_VIEW_ACTION_ICONS[action.type]
          : DEFAULT_VIEW_ACTION_ICONS[action.type];
        return (
          <Button
            key={`action-${action.type}-${idx}`}
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onViewAction?.(action.type, currentView!)}
            title={DEFAULT_VIEW_ACTION_LABELS[action.type] || action.type}
          >
            {ActionIcon ? <ActionIcon className="h-3.5 w-3.5" /> : null}
          </Button>
        );
      })}
    </div>
  ) : null;

  const createViewButton = schema.allowCreateView ? (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={() => onCreateView?.()}
      title={createViewLabel}
    >
      <Plus className="h-3.5 w-3.5" />
    </Button>
  ) : null;

  const switcher = (
    <div className={cn(viewSwitcherWidth({ orientation }), 'flex items-center gap-1')}>
      {variant === 'dropdown' && (
        <Select value={currentViewValue} onValueChange={(value) => handleViewChange(value as ViewType)}>
          <SelectTrigger className={cn('w-full', isVertical ? 'h-10' : 'h-9')}>
            <SelectValue placeholder="Select view" />
          </SelectTrigger>
          <SelectContent>
            {schema.views.map((view, index) => (
              <SelectItem key={`${view.type}-${index}`} value={view.type}>
                {getViewLabel(view)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {variant === 'buttons' && (
        <div className={cn(viewSwitcherList({ orientation }))}>
          {schema.views.map((view, index) => {
            const isActive = view.type === currentView;
            const Icon = getViewIcon(view);

            return (
              <Button
                key={`${view.type}-${index}`}
                type="button"
                size="sm"
                variant={isActive ? 'secondary' : 'ghost'}
                className={cn('justify-start gap-2', isVertical ? 'w-full' : '')}
                onClick={() => handleViewChange(view.type)}
              >
                {Icon ? <Icon className="h-4 w-4" /> : null}
                <span>{getViewLabel(view)}</span>
              </Button>
            );
          })}
        </div>
      )}

      {variant === 'tabs' && (
        <Tabs value={currentViewValue} onValueChange={(value) => handleViewChange(value as ViewType)}>
          <TabsList className={cn(viewSwitcherTabsList({ orientation }))}>
            {schema.views.map((view, index) => {
              const Icon = getViewIcon(view);
              return (
                <TabsTrigger
                  key={`${view.type}-${index}`}
                  value={view.type}
                  className={cn('gap-2', isVertical ? 'justify-start' : '')}
                >
                  {Icon ? <Icon className="h-4 w-4" /> : null}
                  <span>{getViewLabel(view)}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      )}

      {viewActionButtons}
      {createViewButton}
    </div>
  );

  const viewContent = (() => {
    if (!currentViewConfig?.schema) return null;

    if (Array.isArray(currentViewConfig.schema)) {
      return (
        <div className="space-y-4">
          {currentViewConfig.schema.map((node, index) => (
            <SchemaRenderer key={`${currentViewConfig.type}-${index}`} schema={node} {...props} />
          ))}
        </div>
      );
    }

    return <SchemaRenderer schema={currentViewConfig.schema} {...props} />;
  })();

  return (
    <div
      className={cn(
        viewSwitcherLayout({ position }),
        className
      )}
    >
      <div className={cn('shrink-0', isVertical ? 'flex flex-col' : 'flex')}>{switcher}</div>
      <div className="flex-1 min-w-0">{viewContent}</div>
    </div>
  );
};
