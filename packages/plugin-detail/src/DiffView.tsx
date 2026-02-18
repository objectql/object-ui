/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { cn, Button, Card, CardHeader, CardTitle, CardContent } from '@object-ui/components';
import { Columns2, Rows3 } from 'lucide-react';

export type DiffFieldType = 'string' | 'number' | 'boolean' | 'json' | 'date';
export type DiffMode = 'unified' | 'side-by-side';

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
}

export interface DiffViewProps {
  oldValue: any;
  newValue: any;
  fieldName: string;
  fieldType?: DiffFieldType;
  mode?: DiffMode;
  className?: string;
}

/** Convert a value to diffable string lines based on its type. */
function valueToLines(value: any, fieldType: DiffFieldType): string[] {
  if (value == null) return ['(empty)'];

  switch (fieldType) {
    case 'json':
      try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return JSON.stringify(parsed, null, 2).split('\n');
      } catch {
        return String(value).split('\n');
      }
    case 'boolean':
      return [String(!!value)];
    case 'number':
      return [String(value)];
    case 'date':
      try {
        return [new Date(value).toLocaleString()];
      } catch {
        return [String(value)];
      }
    default:
      return String(value).split('\n');
  }
}

/** Compute a simple line-by-line diff between old and new lines. */
function computeDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const result: DiffLine[] = [];
  const maxLen = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLen; i++) {
    const oldLine = i < oldLines.length ? oldLines[i] : undefined;
    const newLine = i < newLines.length ? newLines[i] : undefined;

    if (oldLine === newLine) {
      result.push({ type: 'unchanged', value: oldLine! });
    } else {
      if (oldLine !== undefined) {
        result.push({ type: 'removed', value: oldLine });
      }
      if (newLine !== undefined) {
        result.push({ type: 'added', value: newLine });
      }
    }
  }

  return result;
}

const LINE_STYLES: Record<DiffLine['type'], string> = {
  added: 'bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300',
  removed: 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300',
  unchanged: 'text-muted-foreground',
};

const LINE_PREFIX: Record<DiffLine['type'], string> = {
  added: '+',
  removed: '-',
  unchanged: ' ',
};

export const DiffView: React.FC<DiffViewProps> = ({
  oldValue,
  newValue,
  fieldName,
  fieldType = 'string',
  mode: initialMode = 'unified',
  className,
}) => {
  const [mode, setMode] = React.useState<DiffMode>(initialMode);

  const oldLines = React.useMemo(() => valueToLines(oldValue, fieldType), [oldValue, fieldType]);
  const newLines = React.useMemo(() => valueToLines(newValue, fieldType), [newValue, fieldType]);
  const diffLines = React.useMemo(() => computeDiff(oldLines, newLines), [oldLines, newLines]);

  const hasChanges = diffLines.some((l) => l.type !== 'unchanged');

  // Build side-by-side pairs
  const sideBySidePairs = React.useMemo(() => {
    if (mode !== 'side-by-side') return [];

    const pairs: { left: DiffLine | null; right: DiffLine | null }[] = [];
    let i = 0;
    while (i < diffLines.length) {
      const line = diffLines[i];
      if (line.type === 'unchanged') {
        pairs.push({ left: line, right: line });
        i++;
      } else if (line.type === 'removed') {
        // Check if next is 'added' to pair them
        const next = i + 1 < diffLines.length ? diffLines[i + 1] : null;
        if (next && next.type === 'added') {
          pairs.push({ left: line, right: next });
          i += 2;
        } else {
          pairs.push({ left: line, right: null });
          i++;
        }
      } else {
        pairs.push({ left: null, right: line });
        i++;
      }
    }
    return pairs;
  }, [mode, diffLines]);

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="font-medium">{fieldName}</span>
          <div className="flex items-center gap-1">
            <Button
              variant={mode === 'unified' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => setMode('unified')}
              title="Unified diff"
            >
              <Rows3 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={mode === 'side-by-side' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => setMode('side-by-side')}
              title="Side-by-side diff"
            >
              <Columns2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {!hasChanges ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">No changes</p>
        ) : mode === 'unified' ? (
          /* Unified diff view */
          <div className="font-mono text-xs overflow-x-auto">
            {diffLines.map((line, index) => (
              <div
                key={index}
                className={cn(
                  'px-4 py-0.5 whitespace-pre-wrap border-l-2',
                  LINE_STYLES[line.type],
                  line.type === 'added' && 'border-l-green-500',
                  line.type === 'removed' && 'border-l-red-500',
                  line.type === 'unchanged' && 'border-l-transparent',
                )}
              >
                <span className="select-none mr-2 inline-block w-3 text-center opacity-60">
                  {LINE_PREFIX[line.type]}
                </span>
                {line.value}
              </div>
            ))}
          </div>
        ) : (
          /* Side-by-side diff view */
          <div className="overflow-x-auto">
            <div className="grid grid-cols-2 divide-x font-mono text-xs min-w-0">
              {/* Headers */}
              <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">
                Previous
              </div>
              <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">
                Current
              </div>
              {/* Rows */}
              {sideBySidePairs.map((pair, index) => (
                <React.Fragment key={index}>
                  <div
                    className={cn(
                      'px-3 py-0.5 whitespace-pre-wrap min-h-[1.5em]',
                      pair.left
                        ? LINE_STYLES[pair.left.type]
                        : 'bg-muted/20',
                    )}
                  >
                    {pair.left?.value ?? ''}
                  </div>
                  <div
                    className={cn(
                      'px-3 py-0.5 whitespace-pre-wrap min-h-[1.5em]',
                      pair.right
                        ? LINE_STYLES[pair.right.type]
                        : 'bg-muted/20',
                    )}
                  >
                    {pair.right?.value ?? ''}
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
