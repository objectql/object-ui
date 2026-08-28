/**
 * Public Forms — surfaces every `view` metadata item with
 * `sharing.allowAnonymous === true && sharing.publicLink`, and lets devs
 * publish a non-public FormView or tweak sharing / submitBehavior.
 *
 * Console is not project-scoped, so there is no `useParams().package`, no
 * `<Link>` to the legacy metadata editor, and no `useMetadataHmr` polling —
 * refresh is driven by the explicit Refresh button.
 *
 * ## The redirect field is an authoring door, so it states the contract
 *
 * `submitBehavior.url` is ruled relative-only (objectstack#7496, landed by
 * objectstack#7657 in the `@objectstack/spec` 17.0.0 GA pin this repo installs),
 * and the spec refuses seven families of value with an author-facing
 * prescription for each. This dialog used to enforce one of them — non-empty —
 * and save the rest into view metadata unexamined (objectui#4990), so an admin
 * could type `https://example.com/thanks`, or `javascript:alert(1)`, and be
 * told nothing.
 *
 * `checkSubmitRedirectUrl` (from the renderer's own `submitRedirect`) is asked
 * instead, at save time, and its refusal — the spec's prose, verbatim — is shown
 * next to the field. That reuse is the point: a hand-written mirror of the seven
 * families here is exactly the shape `scripts/check-spec-symbol-derivation.mjs`
 * exists to discourage, and it would be a second spelling of a security rule
 * that passes every value comparison right up to the release that moves the
 * original. The door and the renderer now refuse identically because they are
 * one parse.
 *
 * `thank-you`'s `title` / `message` stay unvalidated deliberately: the spec
 * declares both as free-form strings, so there is no contract for a door to
 * state.
 */

import { useEffect, useState } from 'react';
import { useAdapter } from '@object-ui/app-shell';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@object-ui/components';
import { Copy, ExternalLink, FormInput, RefreshCw, Code2, Link2, Settings2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { checkSubmitRedirectUrl } from '../../components/submitRedirect';

interface PublicFormRow {
  name: string;
  label?: string;
  object?: string;
  slug: string;
  publicLink: string;
  updatedAt?: string;
  spec: any;
}

interface PublishableFormRow {
  name: string;
  label?: string;
  object?: string;
  spec: any;
}

function slugFromLink(link?: string): string | null {
  if (!link) return null;
  const m = link.replace(/^\/+/, '').match(/^forms\/([^/?#]+)/i);
  return m?.[1] ?? null;
}

function sanitizeSlug(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '');
}

export function PublicFormsPage() {
  const adapter = useAdapter();
  const client: any = adapter?.getClient?.();

  const [rows, setRows] = useState<PublicFormRow[]>([]);
  const [publishable, setPublishable] = useState<PublishableFormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [publishOpen, setPublishOpen] = useState(false);
  const [publishView, setPublishView] = useState<string>('');
  const [publishSlug, setPublishSlug] = useState('');
  const [publishing, setPublishing] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<PublicFormRow | null>(null);
  const [editSlug, setEditSlug] = useState('');
  const [editBehavior, setEditBehavior] = useState<'thank-you' | 'redirect' | 'continue' | 'next-record'>('thank-you');
  const [editBehaviorTitle, setEditBehaviorTitle] = useState('');
  const [editBehaviorMessage, setEditBehaviorMessage] = useState('');
  const [editBehaviorUrl, setEditBehaviorUrl] = useState('');
  /**
   * The contract's refusal for the value currently in the Redirect URL field,
   * or null while there is nothing to say. Set only by a save attempt — typing
   * clears it, so the author is corrected once, at the moment they asked to
   * commit, rather than nagged mid-keystroke.
   */
  const [editUrlRefusal, setEditUrlRefusal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!client?.meta?.getItems) {
      setError('meta.getItems is not available on this client');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result: any = await client.meta.getItems('view');
      const items: any[] = Array.isArray(result)
        ? result
        : Array.isArray(result?.items)
          ? result.items
          : Array.isArray(result?.value)
            ? result.value
            : [];
      const forms: PublicFormRow[] = [];
      const candidates: PublishableFormRow[] = [];
      for (const it of items) {
        const spec = it?.spec ?? it;
        const isForm = !!(
          spec?.sections ||
          spec?.groups ||
          spec?.form ||
          spec?.type === 'simple' ||
          spec?.type === 'tabbed' ||
          spec?.type === 'wizard' ||
          spec?.viewType === 'form'
        );
        if (!isForm) continue;
        const sharing = spec?.sharing;
        const link: string | undefined = sharing?.publicLink;
        const slug = slugFromLink(link);
        if (sharing?.allowAnonymous && slug && link) {
          forms.push({
            name: spec?.name ?? it?.name,
            label: spec?.label,
            object: spec?.object,
            slug,
            publicLink: link,
            updatedAt: it?.updatedAt ?? it?.updated_at,
            spec,
          });
        } else {
          candidates.push({
            name: spec?.name ?? it?.name,
            label: spec?.label,
            object: spec?.object,
            spec,
          });
        }
      }
      setRows(forms);
      setPublishable(candidates);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  // `load` is intentionally omitted from the dependency array: this effect is a
  // mount-once fetch. Refresh is driven by the explicit Refresh button
  // (`onClick={load}` below) and by explicit `await load()` calls after
  // publish/save (see the file-level doc comment), not by re-running on every
  // `load` identity change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const formatPublicUrl = (slug: string) => `${origin}/console/f/${slug}`;
  const formatIframe = (slug: string) =>
    `<iframe src="${formatPublicUrl(slug)}" width="100%" height="640" frameborder="0" style="border:0;"></iframe>`;
  const formatReact = (slug: string) =>
    `<iframe\n  src={\`${formatPublicUrl(slug)}\`}\n  title="Public form"\n  style={{ width: '100%', height: 640, border: 0 }}\n/>`;

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`Copied ${label}`);
    } catch {
      toast.error('Clipboard unavailable');
    }
  };

  const publish = async () => {
    if (!publishView || !publishSlug) return;
    const cand = publishable.find((p) => p.name === publishView);
    if (!cand) return;
    const slug = sanitizeSlug(publishSlug);
    if (!slug) {
      toast.error('Invalid slug');
      return;
    }
    const next = {
      ...cand.spec,
      sharing: {
        ...(cand.spec.sharing ?? {}),
        enabled: true,
        allowAnonymous: true,
        publicLink: `/forms/${slug}`,
      },
    };
    setPublishing(true);
    try {
      await client.meta.saveItem('view', cand.name, next);
      toast.success(`Published ${cand.name}`);
      setPublishOpen(false);
      setPublishView('');
      setPublishSlug('');
      await load();
    } catch (e: any) {
      toast.error(`Publish failed: ${e?.message ?? e}`);
    } finally {
      setPublishing(false);
    }
  };

  const openEditor = (row: PublicFormRow) => {
    setEditRow(row);
    setEditSlug(row.slug);
    const sb = row.spec?.submitBehavior;
    const kind = (sb?.kind as any) ?? 'thank-you';
    setEditBehavior(kind);
    setEditBehaviorTitle(sb?.title ?? '');
    setEditBehaviorMessage(sb?.message ?? '');
    setEditBehaviorUrl(sb?.url ?? '');
    setEditUrlRefusal(null);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editRow) return;
    const slug = sanitizeSlug(editSlug);
    if (!slug) {
      toast.error('Invalid slug');
      return;
    }
    setEditUrlRefusal(null);
    let submitBehavior: any;
    switch (editBehavior) {
      case 'thank-you':
        submitBehavior = { kind: 'thank-you' };
        if (editBehaviorTitle) submitBehavior.title = editBehaviorTitle;
        if (editBehaviorMessage) submitBehavior.message = editBehaviorMessage;
        break;
      case 'redirect': {
        // The contract's verdict, not this dialog's: empty is one of the seven
        // families the spec refuses, so it comes back through here too rather
        // than keeping a local `required` message that says less.
        const verdict = checkSubmitRedirectUrl(editBehaviorUrl);
        if (!verdict.ok) {
          setEditUrlRefusal(verdict.refusal);
          return;
        }
        // The value the schema accepted, so a future normalisation in the spec
        // is what gets saved — the same read-back the renderer does.
        submitBehavior = { kind: 'redirect', url: verdict.url };
        break;
      }
      case 'continue':
      case 'next-record':
        submitBehavior = { kind: editBehavior };
        break;
    }
    const next = {
      ...editRow.spec,
      sharing: {
        ...(editRow.spec.sharing ?? {}),
        enabled: true,
        allowAnonymous: true,
        publicLink: `/forms/${slug}`,
      },
      submitBehavior,
    };
    setSaving(true);
    try {
      await client.meta.saveItem('view', editRow.name, next);
      toast.success(`Saved ${editRow.name}`);
      setEditOpen(false);
      setEditRow(null);
      await load();
    } catch (e: any) {
      toast.error(`Save failed: ${e?.message ?? e}`);
    } finally {
      setSaving(false);
    }
  };

  const hasRows = rows.length > 0;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6 overflow-auto">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FormInput className="h-4 w-4" />
              Public Forms
            </CardTitle>
            <CardDescription>
              Forms anyone can fill out — no login required. Publish a form to get a
              shareable link; submissions land directly in the bound object.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => setPublishOpen(true)}
              disabled={publishable.length === 0}
              title={publishable.length === 0 ? 'No non-public FormViews available' : 'Publish a FormView'}
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="ml-1.5">Publish form…</span>
            </Button>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="ml-1.5">Refresh</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {!loading && !hasRows && (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              <p className="font-medium text-foreground">No public forms yet</p>
              <p className="mt-1">
                Click <strong>Publish form…</strong> above to share an existing form, or
                build a new one in Views &amp; Apps and mark it public.
              </p>
            </div>
          )}
          {hasRows && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Object</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Public URL</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const url = formatPublicUrl(row.slug);
                  return (
                    <TableRow key={row.name}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{row.label ?? row.name}</span>
                          <code className="text-xs text-muted-foreground">{row.name}</code>
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.object ? (
                          <Badge variant="secondary">{row.object}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs">{row.slug}</code>
                      </TableCell>
                      <TableCell>
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
                        >
                          {url}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Copy URL"
                            onClick={() => copy('URL', url)}
                          >
                            <Link2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Copy <iframe> embed"
                            onClick={() => copy('iframe snippet', formatIframe(row.slug))}
                          >
                            <Code2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Copy React snippet"
                            onClick={() => copy('React snippet', formatReact(row.slug))}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Edit sharing & post-submit behavior"
                            onClick={() => openEditor(row)}
                          >
                            <Settings2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Publish a FormView</DialogTitle>
            <DialogDescription>
              Pick an existing FormView and turn it into a public form by
              enabling <code className="text-xs">sharing.allowAnonymous</code>{' '}
              and setting <code className="text-xs">publicLink</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="publish-view">FormView</Label>
              <select
                id="publish-view"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={publishView}
                onChange={(e) => setPublishView(e.target.value)}
              >
                <option value="">— Select a FormView —</option>
                {publishable.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.label ?? p.name} ({p.name}) {p.object ? `· ${p.object}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="publish-slug">URL slug</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">/console/f/</span>
                <Input
                  id="publish-slug"
                  placeholder="contact-us"
                  value={publishSlug}
                  onChange={(e) => setPublishSlug(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Lowercase letters, digits, dashes and underscores only.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPublishOpen(false)} disabled={publishing}>
              Cancel
            </Button>
            <Button onClick={publish} disabled={publishing || !publishView || !publishSlug}>
              {publishing ? 'Publishing…' : 'Publish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editRow ? `Edit ${editRow.label ?? editRow.name}` : 'Edit form'}
            </DialogTitle>
            <DialogDescription>
              Configure the public URL and what happens after submit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-slug">URL slug</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">/console/f/</span>
                <Input
                  id="edit-slug"
                  value={editSlug}
                  onChange={(e) => setEditSlug(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-behavior">After submit</Label>
              <select
                id="edit-behavior"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={editBehavior}
                onChange={(e) => {
                  setEditBehavior(e.target.value as any);
                  setEditUrlRefusal(null);
                }}
              >
                <option value="thank-you">Show a thank-you panel</option>
                <option value="redirect">Redirect to a URL</option>
                <option value="continue">Reset for another response</option>
                <option value="next-record">Advance to next record (internal queues)</option>
              </select>
            </div>
            {editBehavior === 'thank-you' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-tytitle">Title</Label>
                  <Input
                    id="edit-tytitle"
                    placeholder="Thanks!"
                    value={editBehaviorTitle}
                    onChange={(e) => setEditBehaviorTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-tymsg">Message</Label>
                  <Input
                    id="edit-tymsg"
                    placeholder="Your submission has been received."
                    value={editBehaviorMessage}
                    onChange={(e) => setEditBehaviorMessage(e.target.value)}
                  />
                </div>
              </>
            )}
            {editBehavior === 'redirect' && (
              <div className="space-y-1.5">
                <Label htmlFor="edit-url">Redirect URL</Label>
                {/*
                  Not `type="url"`: that type's own notion of valid is an
                  ABSOLUTE URL, which is the one thing this key refuses, so it
                  pulled the author the wrong way — as did the former
                  `https://example.com/thanks` placeholder.
                */}
                <Input
                  id="edit-url"
                  type="text"
                  placeholder="/thanks"
                  value={editBehaviorUrl}
                  onChange={(e) => {
                    setEditBehaviorUrl(e.target.value);
                    setEditUrlRefusal(null);
                  }}
                  aria-invalid={editUrlRefusal ? true : undefined}
                  aria-describedby={editUrlRefusal ? 'edit-url-refusal' : 'edit-url-hint'}
                />
                {editUrlRefusal ? (
                  <p
                    id="edit-url-refusal"
                    role="alert"
                    className="text-xs text-destructive"
                  >
                    {editUrlRefusal}
                  </p>
                ) : (
                  <p id="edit-url-hint" className="text-xs text-muted-foreground">
                    An in-app path, starting with <code>/</code> — interpolate a field of
                    the submitted record as <code>{'{{record.field_name}}'}</code>. To send
                    the browser out of the app, use an app navigation item instead.
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={saving || !editSlug}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
