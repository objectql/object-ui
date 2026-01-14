import React from 'react';
import { cn } from '@object-ui/components';

export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface ResizeHandleProps {
  direction: ResizeDirection;
  onResizeStart: (direction: ResizeDirection, e: React.MouseEvent) => void;
  className?: string;
}

const directionStyles: Record<ResizeDirection, string> = {
  n: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-2 cursor-ns-resize',
  s: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-20 h-2 cursor-ns-resize',
  e: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-2 h-20 cursor-ew-resize',
  w: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-20 cursor-ew-resize',
  ne: 'top-0 right-0 translate-x-1/2 -translate-y-1/2 w-3 h-3 cursor-ne-resize',
  nw: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-3 h-3 cursor-nw-resize',
  se: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-3 h-3 cursor-se-resize',
  sw: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 w-3 h-3 cursor-sw-resize',
};

const directionHoverStyles: Record<ResizeDirection, string> = {
  n: 'hover:h-3',
  s: 'hover:h-3',
  e: 'hover:w-3',
  w: 'hover:w-3',
  ne: 'hover:w-4 hover:h-4',
  nw: 'hover:w-4 hover:h-4',
  se: 'hover:w-4 hover:h-4',
  sw: 'hover:w-4 hover:h-4',
};

export const ResizeHandle: React.FC<ResizeHandleProps> = ({ direction, onResizeStart, className }) => {
  const isCorner = ['ne', 'nw', 'se', 'sw'].includes(direction);

  return (
    <div
      className={cn(
        'absolute z-50 group transition-all duration-150',
        directionStyles[direction],
        directionHoverStyles[direction],
        className
      )}
      onMouseDown={(e) => {
        e.stopPropagation();
        onResizeStart(direction, e);
      }}
    >
      <div
        className={cn(
          'w-full h-full rounded-full transition-all duration-150',
          isCorner
            ? 'bg-indigo-500 border-2 border-white shadow-lg opacity-0 group-hover:opacity-100'
            : 'bg-indigo-400 opacity-0 group-hover:opacity-70'
        )}
      />
    </div>
  );
};

interface ResizeHandlesProps {
  directions: ResizeDirection[];
  onResizeStart: (direction: ResizeDirection, e: React.MouseEvent) => void;
  className?: string;
}

export const ResizeHandles: React.FC<ResizeHandlesProps> = ({ directions, onResizeStart, className }) => {
  return (
    <>
      {directions.map((direction) => (
        <ResizeHandle
          key={direction}
          direction={direction}
          onResizeStart={onResizeStart}
          className={className}
        />
      ))}
    </>
  );
};
