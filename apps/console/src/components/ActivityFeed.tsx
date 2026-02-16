/**
 * ActivityFeed
 *
 * Sidebar panel that displays recent activity items (create, update, delete,
 * comment). Opens as a slide-out Sheet triggered by a bell icon button.
 * Phase 17 L1 – local state only, no server integration.
 * @module
 */

import { useState } from 'react';
import {
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@object-ui/components';
import { Bell, Plus, Pencil, Trash2, MessageSquare } from 'lucide-react';

export interface ActivityItem {
  id: string;
  type: 'create' | 'update' | 'delete' | 'comment';
  objectName: string;
  recordId?: string;
  user: string;
  description: string;
  timestamp: string;
}

export interface ActivityFeedProps {
  activities?: ActivityItem[];
  className?: string;
}

const typeConfig: Record<
  ActivityItem['type'],
  { icon: React.ElementType; color: string }
> = {
  create: { icon: Plus, color: 'text-green-500' },
  update: { icon: Pencil, color: 'text-blue-500' },
  delete: { icon: Trash2, color: 'text-red-500' },
  comment: { icon: MessageSquare, color: 'text-amber-500' },
};

/** Format an ISO timestamp as a relative string (e.g. "2m ago"). */
function formatRelativeTime(iso: string): string {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return '';
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return `${Math.max(seconds, 0)}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ActivityFeed({ activities = [], className }: ActivityFeedProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className ?? 'h-8 w-8'}
          aria-label="Activity feed"
        >
          <Bell className="h-4 w-4" />
          {activities.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center">
              {activities.length > 9 ? '9+' : activities.length}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-80 sm:w-96">
        <SheetHeader>
          <SheetTitle>Recent Activity</SheetTitle>
        </SheetHeader>

        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
            <Bell className="h-8 w-8 opacity-40" />
            <p className="text-sm">No recent activity</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-1 overflow-y-auto max-h-[calc(100vh-8rem)]">
            {activities.map((item) => {
              const { icon: Icon, color } = typeConfig[item.type];
              return (
                <li
                  key={item.id}
                  className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/50 transition-colors"
                >
                  <span className={`mt-0.5 shrink-0 ${color}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">{item.description}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.user} · {formatRelativeTime(item.timestamp)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}
