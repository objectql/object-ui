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
  Badge,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@object-ui/components';
import { Share2, Copy, Check, Lock, Calendar } from 'lucide-react';

export interface SharedViewLinkProps {
  /** The object name used in the share URL path */
  objectName: string;
  /** Optional view identifier; defaults to "default" */
  viewId?: string;
  /** Base URL for the shareable link (defaults to window.location.origin) */
  baseUrl?: string;
  /** Callback fired after a share URL is generated */
  onShare?: (shareUrl: string, options?: { password?: string; expiresAt?: string }) => void;
  className?: string;
}

function generateToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function buildShareUrl(baseUrl: string, objectName: string, viewId: string, token: string): string {
  return `${baseUrl}/share/${objectName}/${viewId}?mode=readonly&token=${token}`;
}

export const SharedViewLink: React.FC<SharedViewLinkProps> = ({
  objectName,
  viewId = 'default',
  baseUrl,
  onShare,
  className,
}) => {
  const [shareUrl, setShareUrl] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [password, setPassword] = React.useState('');
  const [expiresIn, setExpiresIn] = React.useState('');

  const resolvedBaseUrl = baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : '');

  const handleGenerateLink = React.useCallback(() => {
    const token = generateToken();
    const url = buildShareUrl(resolvedBaseUrl, objectName, viewId, token);
    setShareUrl(url);
    setCopied(false);
    const expiresAt = expiresIn ? new Date(Date.now() + parseInt(expiresIn, 10) * 86400000).toISOString() : undefined;
    onShare?.(url, { password: password || undefined, expiresAt });
  }, [resolvedBaseUrl, objectName, viewId, onShare, password, expiresIn]);

  const handleCopy = React.useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareUrl]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn('gap-2', className)}>
          <Share2 className="h-4 w-4" />
          Share
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 space-y-4" align="end">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Share View</h4>
            <Badge variant="secondary" className="text-xs">
              Read-only
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Generate a public link to share this view. Recipients can view data without logging in.
          </p>
        </div>

        {!shareUrl ? (
          <div className="space-y-3">
            {/* Password protection */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Lock className="h-3.5 w-3.5" />
                Password protection (optional)
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                className="h-8 text-xs"
              />
            </div>

            {/* Expiration */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Calendar className="h-3.5 w-3.5" />
                Expires after (optional)
              </label>
              <select
                value={expiresIn}
                onChange={(e) => setExpiresIn(e.target.value)}
                className="w-full h-8 text-xs rounded-md border border-input bg-background px-3"
              >
                <option value="">Never</option>
                <option value="1">1 day</option>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
              </select>
            </div>

            <Button onClick={handleGenerateLink} className="w-full gap-2" size="sm">
              <Share2 className="h-4 w-4" />
              Generate Link
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              value={shareUrl}
              readOnly
              className="h-8 text-xs"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="shrink-0 gap-1"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          {/* Share options indicators */}
          <div className="flex items-center gap-2 flex-wrap">
            {password && (
              <Badge variant="outline" className="text-xs gap-1">
                <Lock className="h-3 w-3" />
                Password protected
              </Badge>
            )}
            {expiresIn && (
              <Badge variant="outline" className="text-xs gap-1">
                <Calendar className="h-3 w-3" />
                Expires in {expiresIn} day{expiresIn !== '1' ? 's' : ''}
              </Badge>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
