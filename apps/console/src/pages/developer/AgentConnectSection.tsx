/**
 * AgentConnectSection (ADR-0036 Phase 2b)
 *
 * Surfaces "connect an AI agent to this environment over MCP" on the
 * Integrations page: shows the env's MCP endpoint (from /discovery, opt-in via
 * OS_MCP_SERVER_ENABLED), mints a show-once API key (POST /api/v1/keys), offers
 * a one-click portable Skill download, and gives copy-paste connect steps.
 *
 * One connection per ENVIRONMENT (not per app) — the agent discovers apps/
 * objects live via the MCP tools, so a new app needs no reinstall.
 */

import { useEffect, useState, type ChangeEvent } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  Alert,
  AlertTitle,
  AlertDescription,
} from '@object-ui/components';
import { Bot, KeyRound, Copy, Check, Download, ShieldAlert } from 'lucide-react';

import { renderObjectStackSkill } from './objectstack-skill';

interface GeneratedKey {
  id?: string;
  name?: string;
  prefix?: string;
  key: string;
}

function useCopy(): [boolean, (v: string) => void] {
  const [copied, setCopied] = useState(false);
  const copy = (v: string) => {
    void navigator.clipboard?.writeText(v);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return [copied, copy];
}

function InlineCopy({ value, label }: { value: string; label?: string }) {
  const [copied, copy] = useCopy();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 gap-1.5 px-2 text-xs"
      onClick={() => copy(value)}
      aria-label={`Copy ${label ?? 'value'}`}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

export function AgentConnectSection() {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const [mcpUrl, setMcpUrl] = useState<string | null>(null);
  const [mcpEnabled, setMcpEnabled] = useState<boolean | null>(null);

  const [keyName, setKeyName] = useState('Agent key');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedKey | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [keyCopied, copyKey] = useCopy();

  // Discover whether MCP is enabled + its URL.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/v1/discovery', { credentials: 'include' });
        const json = await res.json().catch(() => ({}));
        const route: string | undefined = json?.data?.routes?.mcp ?? json?.routes?.mcp;
        if (cancelled) return;
        if (route) {
          setMcpUrl(route.startsWith('http') ? route : `${origin}${route}`);
          setMcpEnabled(true);
        } else {
          setMcpEnabled(false);
        }
      } catch {
        if (!cancelled) setMcpEnabled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [origin]);

  const generateKey = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/keys', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: keyName.trim() || 'Agent key' }),
      });
      const json = await res.json().catch(() => ({}));
      const data = json?.data;
      if (!res.ok || !data?.key) {
        throw new Error(json?.error?.message || `Request failed (${res.status})`);
      }
      setGenerated(data as GeneratedKey);
      setDialogOpen(true);
    } catch (e) {
      setError((e as Error)?.message ?? 'Failed to generate key');
    } finally {
      setGenerating(false);
    }
  };

  const downloadSkill = () => {
    const md = renderObjectStackSkill({ mcpUrl: mcpUrl ?? undefined });
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'SKILL.md';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const effectiveUrl = mcpUrl ?? `${origin}/api/v1/mcp`;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="size-4" /> Connect an AI agent (MCP)
        </CardTitle>
        <CardDescription className="text-xs">
          Every app in this environment is an agent-ready toolset. Connect Claude, Cursor, Codex or
          any MCP client — one connection covers all your apps (new ones appear automatically).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* MCP endpoint */}
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">MCP endpoint</div>
          {mcpEnabled === false ? (
            <Alert>
              <ShieldAlert className="size-4" />
              <AlertTitle>MCP is not enabled for this environment</AlertTitle>
              <AlertDescription className="text-xs">
                Connecting agents is opt-in. An admin can enable it by setting{' '}
                <code className="font-mono">OS_MCP_SERVER_ENABLED=true</code>. You can still
                generate a key and download the skill below.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-muted px-2 py-1.5 font-mono text-xs">
                {effectiveUrl}
              </code>
              <InlineCopy value={effectiveUrl} label="MCP URL" />
            </div>
          )}
        </div>

        {/* Generate key */}
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <KeyRound className="size-3.5" /> API key
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={keyName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setKeyName(e.target.value)}
              placeholder="Key name (e.g. Claude desktop)"
              className="h-8 max-w-xs text-sm"
            />
            <Button type="button" size="sm" onClick={generateKey} disabled={generating}>
              {generating ? 'Generating…' : 'Generate key'}
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            The key acts as you (your permissions + row-level security). Shown once — copy it
            immediately. Revoke anytime from the API Keys list.
          </p>
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>

        {/* Skill */}
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">Agent skill (portable)</div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={downloadSkill}>
              <Download className="size-4" /> Download SKILL.md
            </Button>
            <span className="text-xs text-muted-foreground">
              Works with any skills-capable agent (Claude, Codex, Gemini, Cursor…).
            </span>
          </div>
        </div>

        {/* Connect steps */}
        <div className="rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed">
          <div className="mb-1 font-medium">Connect in 3 steps</div>
          <ol className="list-decimal space-y-0.5 pl-4 text-muted-foreground">
            <li>Add a remote MCP server pointing at the endpoint above.</li>
            <li>
              Set the header <code className="font-mono">x-api-key: &lt;your key&gt;</code> (a
              session Bearer is <em>not</em> an API key).
            </li>
            <li>Drop in <code className="font-mono">SKILL.md</code> so the agent knows how to drive your data.</li>
          </ol>
        </div>
      </CardContent>

      {/* Show-once key dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-4" /> Your new API key
            </DialogTitle>
            <DialogDescription>
              Copy this now — for your security it will <strong>not be shown again</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-muted px-2 py-2 font-mono text-xs">
                {generated?.key}
              </code>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1.5"
                onClick={() => generated && copyKey(generated.key)}
              >
                {keyCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {keyCopied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <Alert>
              <ShieldAlert className="size-4" />
              <AlertDescription className="text-xs">
                Send it as <code className="font-mono">x-api-key</code>. It carries your
                permissions — store it like a password and revoke it if leaked.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
