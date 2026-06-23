/**
 * SharedRecordPage — public landing for a `/s/:token` share link.
 *
 * Renders OUTSIDE the authenticated console shell so anonymous visitors
 * can open the URL. Calls the framework's
 * `GET /api/v1/share-links/:token/resolve` endpoint, which:
 *
 *   • Looks up the capability token
 *   • Validates expiry / revocation / password / audience
 *   • Returns the underlying record with redacted fields stripped
 *
 * For `ai_conversations`, we also fetch the linked messages and render
 * a read-only transcript with the SAME `ChatbotEnhanced` renderer the live
 * chat uses (in `readOnly` mode — no composer), so assistant tool calls show
 * as proper proposed-plan / draft cards instead of a raw tool-result JSON
 * dump. Other object kinds fall back to a generic JSON preview.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Link2, Loader2, MessageSquare } from 'lucide-react';

import {
  Button,
  Input,
  Label,
  Badge,
} from '@object-ui/components';
import {
  aiMessageRowsToServerMessages,
  hydratedMessagesToChatMessages,
  toUIMessages,
  type RawAiMessageRow,
} from '@object-ui/app-shell';
import { ChatbotEnhanced } from '@object-ui/plugin-chatbot';

interface ResolvedShare {
  link: {
    id: string;
    token: string;
    object_name: string;
    record_id: string;
    permission: 'view' | 'comment' | 'edit';
    audience: string;
    expires_at?: string | null;
    label?: string | null;
  };
  record: Record<string, unknown>;
  redactedFields?: string[];
}

function resolveServerUrl(): string {
  const env = (import.meta as any).env ?? {};
  const explicit = (env.VITE_SERVER_URL as string | undefined) ?? '';
  if (explicit) return explicit.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

export default function SharedRecordPage() {
  const { token } = useParams<{ token: string }>();
  const serverUrl = useMemo(() => resolveServerUrl(), []);
  const apiBase = `${serverUrl}/api/v1`;

  const [data, setData] = useState<ResolvedShare | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [messages, setMessages] = useState<RawAiMessageRow[] | null>(null);

  const fetchResolve = useCallback(
    async (pw?: string) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const url = new URL(`${apiBase}/share-links/${encodeURIComponent(token)}/resolve`);
        if (pw) url.searchParams.set('password', pw);
        const res = await fetch(url.toString(), {
          headers: { Accept: 'application/json' },
        });
        if (res.status === 401) {
          setNeedsPassword(true);
          setError(pw ? 'Wrong password.' : null);
          setLoading(false);
          return;
        }
        if (res.status === 404) {
          setError('This link is invalid or no longer available.');
          setLoading(false);
          return;
        }
        if (res.status === 410) {
          setError('This link has expired or was revoked.');
          setLoading(false);
          return;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setError(body?.error?.message ?? `Failed to load (HTTP ${res.status}).`);
          setLoading(false);
          return;
        }
        const body = (await res.json()) as
          | { data: ResolvedShare }
          | { record: unknown; link: ResolvedShare['link']; redactFields?: string[] };
        const resolved: ResolvedShare =
          'data' in body
            ? body.data
            : {
                record: body.record as Record<string, unknown>,
                link: body.link,
                redactedFields: (body as any).redactFields,
              };
        setData(resolved);
        setNeedsPassword(false);
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load shared content.');
      } finally {
        setLoading(false);
      }
    },
    [apiBase, token],
  );

  useEffect(() => {
    void fetchResolve();
  }, [fetchResolve]);

  // For AI conversations, fetch the messages alongside the conversation row.
  useEffect(() => {
    if (!data || data.link.object_name !== 'ai_conversations') return;
    const url = `${apiBase}/share-links/${encodeURIComponent(
      data.link.token,
    )}/messages`;
    fetch(url, { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => setMessages(body?.data ?? []))
      .catch(() => setMessages([]));
  }, [apiBase, data]);

  // Reconstruct the same renderable chat messages the authenticated chat builds
  // (tool CALLS merged with their RESULTS → proposed-plan / draft cards) instead
  // of dumping the raw `{"type":"tool-result",…}` envelope as text. The share
  // endpoint returns FLAT `ai_messages` rows, so we first re-assemble the
  // ModelMessage shape (`aiMessageRowsToServerMessages`) that the live path gets
  // server-side, then run the identical hydrate → map pipeline.
  const chatMessages = useMemo(
    () =>
      messages
        ? hydratedMessagesToChatMessages(toUIMessages(aiMessageRowsToServerMessages(messages)))
        : [],
    [messages],
  );

  if (loading) {
    return (
      <div className="flex h-svh w-full items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div className="mx-auto flex h-svh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <Link2 className="h-8 w-8 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Password required</h1>
        <p className="text-sm text-muted-foreground">
          The owner protected this link with a password.
        </p>
        <form
          className="flex w-full flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void fetchResolve(password);
          }}
        >
          <Label htmlFor="share-pw" className="sr-only">
            Password
          </Label>
          <Input
            id="share-pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            placeholder="Enter password"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" size="sm">
            Continue
          </Button>
        </form>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex h-svh max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <h1 className="text-lg font-semibold">Can't open this link</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  if (data.link.object_name === 'ai_conversations') {
    const conv = data.record as { id: string; title?: string };
    return (
      <div className="mx-auto flex h-svh max-w-3xl flex-col bg-background">
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background px-4 py-3">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold">
              {conv.title ?? 'Shared conversation'}
            </h1>
            <p className="truncate text-[11px] text-muted-foreground">
              Read-only · Shared via ObjectStack
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] capitalize">
            {data.link.permission}
          </Badge>
        </header>
        <main className="flex min-h-0 flex-1 flex-col">
          {messages == null ? (
            <div className="flex flex-1 items-center justify-center py-12 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading messages…
            </div>
          ) : messages.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              This conversation has no messages yet.
            </p>
          ) : (
            <ChatbotEnhanced
              readOnly
              surface="plain"
              messages={chatMessages}
              showAvatars
              maxHeight="100%"
              className="flex-1"
            />
          )}
        </main>
        <footer className="border-t bg-muted/30 px-4 py-2 text-center text-[11px] text-muted-foreground">
          Powered by ObjectStack
        </footer>
      </div>
    );
  }

  // Generic fallback: dump the JSON record.
  return (
    <div className="mx-auto flex h-svh max-w-3xl flex-col bg-background">
      <header className="border-b px-4 py-3">
        <h1 className="text-sm font-semibold">
          Shared {data.link.object_name}
        </h1>
      </header>
      <main className="flex-1 overflow-y-auto p-4">
        <pre className="overflow-x-auto rounded-md border bg-muted/30 p-3 text-[12px]">
          {JSON.stringify(data.record, null, 2)}
        </pre>
        {data.redactedFields && data.redactedFields.length > 0 && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Some fields are hidden by the owner: {data.redactedFields.join(', ')}
          </p>
        )}
      </main>
    </div>
  );
}
