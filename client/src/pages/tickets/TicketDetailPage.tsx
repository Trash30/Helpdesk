import React, { useState, useRef, useCallback, useEffect, KeyboardEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import {
  Phone, Mail, ExternalLink, Paperclip, Download, Trash2,
  XCircle, RefreshCw, Bold, Italic, Code, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/axios';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/stores/authStore';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PriorityBadge } from '@/components/common/PriorityBadge';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min}min`;
  if (hour < 24) return `il y a ${hour}h`;
  if (day === 1) return 'hier';
  if (day < 30) return `il y a ${day}j`;
  return date.toLocaleDateString('fr-FR');
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
}

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 50%, 45%)`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Types ────────────────────────────────────────────────────────────────────

interface Ticket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    company: string | null;
    phone: string | null;
    email: string | null;
    role: { id: string; name: string; color: string } | null;
    organisation: { id: string; name: string } | null;
    club: { id: string; name: string } | null;
    pole: { id: string; name: string } | null;
  } | null;
  assignedTo: { id: string; firstName: string; lastName: string } | null;
  category: { id: string; name: string; slug?: string; color: string } | null;
  createdBy: { id: string; firstName: string; lastName: string } | null;
  comments: Comment[];
  attachments: Attachment[];
  activityLogs: ActivityLog[];
}

interface Comment {
  id: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
  author: { id: string; firstName: string; lastName: string };
  attachments: Attachment[];
}

interface Attachment {
  id: string;
  originalName: string;
  size: number;
  mimetype: string;
  createdAt: string;
  uploadedBy: { firstName: string; lastName: string } | null;
}

interface ActivityLog {
  id: string;
  action: string;
  createdAt: string;
  user: { firstName: string; lastName: string } | null;
}

interface TimelineItem {
  id: string;
  type: 'comment' | 'activity';
  createdAt: string;
  data: Comment | ActivityLog;
}

interface Category { id: string; name: string; slug?: string; color: string }
interface Agent { id: string; firstName: string; lastName: string }

// ── Inline editable title ────────────────────────────────────────────────────

function InlineTitle({
  value,
  onSave,
  canEdit,
}: {
  value: string;
  onSave: (v: string) => void;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    if (draft.trim() && draft !== value) onSave(draft.trim());
    setEditing(false);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') { setDraft(value); setEditing(false); }
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKey}
        className="w-full text-2xl font-bold bg-transparent border-b-2 border-primary outline-none py-0.5"
      />
    );
  }

  return (
    <h1
      className={`text-2xl font-bold leading-snug ${canEdit ? 'cursor-text hover:bg-muted/40 rounded px-1 -mx-1' : ''}`}
      onClick={() => canEdit && setEditing(true)}
      title={canEdit ? 'Cliquer pour modifier' : undefined}
    >
      {value}
    </h1>
  );
}

// ── Inline editable description ──────────────────────────────────────────────

function InlineDescription({
  value,
  onSave,
  canEdit,
}: {
  value: string | null;
  onSave: (v: string) => void;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editing) return;
    function outside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        commit();
      }
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [editing, draft]);

  const commit = () => {
    if (draft !== (value ?? '')) onSave(draft);
    setEditing(false);
  };

  const insertMarkdown = (prefix: string, suffix = prefix) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = draft.substring(start, end);
    const newVal = draft.substring(0, start) + prefix + sel + suffix + draft.substring(end);
    setDraft(newVal);
    setTimeout(() => {
      ta.selectionStart = start + prefix.length;
      ta.selectionEnd = end + prefix.length;
      ta.focus();
    }, 0);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false); }
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b') { e.preventDefault(); insertMarkdown('**'); }
      if (e.key === 'i') { e.preventDefault(); insertMarkdown('*'); }
      if (e.key === '`') { e.preventDefault(); insertMarkdown('`'); }
    }
  };

  if (editing) {
    return (
      <div ref={containerRef} className="space-y-1">
        <div className="flex gap-1 border-b pb-1">
          <button type="button" onClick={() => insertMarkdown('**')}
            className="p-1 rounded hover:bg-muted" title="Gras (Ctrl+B)">
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => insertMarkdown('*')}
            className="p-1 rounded hover:bg-muted" title="Italique (Ctrl+I)">
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => insertMarkdown('`')}
            className="p-1 rounded hover:bg-muted" title="Code (Ctrl+`)">
            <Code className="h-3.5 w-3.5" />
          </button>
        </div>
        <textarea
          ref={textareaRef}
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={onKey}
          rows={5}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
        />
      </div>
    );
  }

  if (!value) {
    return (
      <div
        onClick={() => canEdit && setEditing(true)}
        className={`text-muted-foreground text-sm italic ${canEdit ? 'cursor-text hover:bg-muted/30 rounded p-1' : ''}`}
      >
        {canEdit ? 'Cliquer pour ajouter une description...' : 'Aucune description'}
      </div>
    );
  }

  return (
    <div
      onClick={() => canEdit && setEditing(true)}
      className={`prose prose-sm max-w-none text-sm ${canEdit ? 'cursor-text hover:bg-muted/30 rounded p-1' : ''}`}
    >
      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{value}</ReactMarkdown>
    </div>
  );
}

// ── Timeline ─────────────────────────────────────────────────────────────────

function Timeline({
  items,
  currentUserId,
  canDeleteAny,
}: {
  items: TimelineItem[];
  currentUserId: string;
  canDeleteAny: boolean;
}) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();

  const doDelete = useCallback(async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/comments/${deleteId}`);
      queryClient.invalidateQueries({ queryKey: ['ticket'] });
      toast.success('Commentaire supprimé');
    } catch {
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }, [deleteId, queryClient]);

  return (
    <>
      <div className="space-y-4">
        {items.map(item => {
          if (item.type === 'activity') {
            const log = item.data as ActivityLog;
            return (
              <div key={item.id} className="flex items-start gap-3">
                <div className="mt-2 h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0 ml-3" />
                <p className="text-xs text-muted-foreground italic py-1">
                  <span className="font-medium text-foreground not-italic">
                    {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Système'}
                  </span>{' '}
                  {log.action}
                  {' · '}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-default">{relativeTime(log.createdAt)}</span>
                    </TooltipTrigger>
                    <TooltipContent>{formatDate(log.createdAt)}</TooltipContent>
                  </Tooltip>
                </p>
              </div>
            );
          }

          const comment = item.data as Comment;
          const isOwn = comment.author.id === currentUserId;
          const canDelete = isOwn || canDeleteAny;

          return (
            <div
              key={item.id}
              className={`rounded-lg border p-4 group relative ${
                comment.isInternal ? 'border-l-4 border-l-yellow-400 bg-yellow-50/50' : 'bg-card'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {getInitials(comment.author.firstName, comment.author.lastName)}
                </span>
                <div className="flex-1">
                  <span className="text-sm font-medium">
                    {comment.author.firstName} {comment.author.lastName}
                  </span>
                  {comment.isInternal && (
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-yellow-200 text-yellow-800">
                      Note interne
                    </span>
                  )}
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs text-muted-foreground cursor-default">
                      {relativeTime(comment.createdAt)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{formatDate(comment.createdAt)}</TooltipContent>
                </Tooltip>
                {canDelete && (
                  <button
                    onClick={() => setDeleteId(comment.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-muted-foreground hover:text-destructive"
                    title="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="prose prose-sm max-w-none text-sm ml-10">
                <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{comment.content}</ReactMarkdown>
              </div>
              {comment.attachments && comment.attachments.length > 0 && (
                <div className="ml-10 mt-2 flex flex-wrap gap-2">
                  {comment.attachments.map(att => (
                    <a
                      key={att.id}
                      href={`/api/attachments/${att.id}/download`}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-muted/50 text-xs hover:bg-muted transition-colors"
                      title={`${att.originalName} (${formatBytes(att.size)})`}
                    >
                      {att.mimetype.startsWith('image/') ? (
                        <img
                          src={`/api/attachments/${att.id}/download`}
                          alt={att.originalName}
                          className="h-4 w-4 object-cover rounded"
                        />
                      ) : (
                        <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span className="max-w-[120px] truncate">{att.originalName}</span>
                      <Download className="h-3 w-3 text-muted-foreground shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={open => !open && setDeleteId(null)}
        title="Supprimer le commentaire"
        description="Cette action est irréversible."
        confirmLabel="Supprimer"
        variant="destructive"
        loading={deleting}
        onConfirm={doDelete}
      />
    </>
  );
}

// ── Comment input ─────────────────────────────────────────────────────────────

function CommentInput({ ticketId, onAdded }: { ticketId: string; onAdded: () => void }) {
  const [content, setContent] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertMarkdown = (prefix: string, suffix = prefix) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = content.substring(start, end);
    const newVal = content.substring(0, start) + prefix + sel + suffix + content.substring(end);
    setContent(newVal);
    setTimeout(() => {
      ta.selectionStart = start + prefix.length;
      ta.selectionEnd = end + prefix.length;
      ta.focus();
    }, 0);
  };

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const added = Array.from(newFiles).slice(0, 5 - files.length);
    setFiles(prev => [...prev, ...added]);
  };

  const removeFile = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i));

  const canSubmit = content.trim().length > 0 || files.length > 0;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('content', content.trim());
      formData.append('isInternal', String(isInternal));
      files.forEach(f => formData.append('files', f));
      await api.post(`/tickets/${ticketId}/comments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setContent('');
      setFiles([]);
      onAdded();
    } catch {
      toast.error('Erreur lors de l\'ajout du commentaire');
    } finally {
      setSubmitting(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); submit(); }
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b') { e.preventDefault(); insertMarkdown('**'); }
      if (e.key === 'i') { e.preventDefault(); insertMarkdown('*'); }
      if (e.key === '`') { e.preventDefault(); insertMarkdown('`'); }
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex gap-1 border-b px-3 py-2 bg-muted/30">
        <button type="button" onClick={() => insertMarkdown('**')}
          className="p-1 rounded hover:bg-muted text-muted-foreground" title="Gras (Ctrl+B)">
          <Bold className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => insertMarkdown('*')}
          className="p-1 rounded hover:bg-muted text-muted-foreground" title="Italique (Ctrl+I)">
          <Italic className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => insertMarkdown('`')}
          className="p-1 rounded hover:bg-muted text-muted-foreground" title="Code (Ctrl+`)">
          <Code className="h-4 w-4" />
        </button>
      </div>

      <textarea
        ref={textareaRef}
        value={content}
        onChange={e => setContent(e.target.value)}
        onKeyDown={onKey}
        placeholder="Ajouter un commentaire... (Ctrl+Entrée pour envoyer)"
        rows={3}
        className="w-full px-3 py-2 text-sm focus:outline-none resize-y bg-background"
      />

      {/* File list */}
      {files.length > 0 && (
        <div className="px-3 py-2 border-t flex flex-wrap gap-2 bg-muted/10">
          {files.map((f, i) => (
            <span key={i} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border bg-muted/50 max-w-[160px]">
              <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="truncate">{f.name}</span>
              <button type="button" onClick={() => removeFile(i)} className="shrink-0 text-muted-foreground hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/20">
        <div className="flex items-center gap-3">
          <Switch
            id="internal-toggle"
            checked={isInternal}
            onCheckedChange={setIsInternal}
            className={isInternal ? '[&[data-state=checked]]:bg-yellow-500' : ''}
          />
          <label
            htmlFor="internal-toggle"
            className={`text-sm cursor-pointer ${isInternal ? 'text-yellow-700 font-medium' : 'text-muted-foreground'}`}
          >
            Note interne
          </label>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-1.5 py-1 rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            title={files.length >= 5 ? '5 fichiers maximum atteint' : 'Ajouter des pièces jointes'}
            disabled={files.length >= 5}
          >
            <Paperclip className="h-3.5 w-3.5" />
            {files.length >= 5 ? 'Max atteint' : 'Joindre'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => { addFiles(e.target.files); e.target.value = ''; }}
          />
        </div>
        <Button
          size="sm"
          onClick={submit}
          disabled={submitting || !canSubmit}
        >
          {submitting ? 'Envoi...' : 'Ajouter un commentaire'}
        </Button>
      </div>
    </div>
  );
}

// ── Right panel dropdown row ─────────────────────────────────────────────────

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      {children}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const currentUser = useAuthStore(s => s.user);
  const queryClient = useQueryClient();

  const [confirmAction, setConfirmAction] = useState<'close' | 'reopen' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [closingNoteOpen, setClosingNoteOpen] = useState(false);
  const [closingNote, setClosingNote] = useState('');
  const [closingLoading, setClosingLoading] = useState(false);
  const [materialDetail, setMaterialDetail] = useState('');
  const { data: ticket, isLoading, error } = useQuery<Ticket>({
    queryKey: ['ticket', id],
    queryFn: async () => (await api.get(`/tickets/${id}`)).data?.data,
    refetchInterval: 30000,
    enabled: !!id,
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => (await api.get('/categories')).data?.data ?? [],
  });

  const { data: agents } = useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: async () => {
      try {
        const res = await api.get('/admin/users');
        return res.data?.data ?? [];
      } catch {
        return [];
      }
    },
    enabled: can('tickets.assign'),
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['ticket', id] });
  }, [id, queryClient]);

  const updateField = useCallback(async (fields: Record<string, unknown>) => {
    try {
      await api.put(`/tickets/${id}`, fields);
      invalidate();
    } catch {
      toast.error('Erreur lors de la mise à jour');
      invalidate();
    }
  }, [id, invalidate]);

  const updateStatus = useCallback(async (status: string) => {
    // Optimistic update
    queryClient.setQueryData<Ticket>(['ticket', id], old =>
      old ? { ...old, status } : old
    );
    try {
      await api.patch(`/tickets/${id}/status`, { status });
      invalidate();
    } catch {
      toast.error('Erreur lors du changement de statut');
      invalidate();
    }
  }, [id, invalidate, queryClient]);

  const updateAssign = useCallback(async (assignedToId: string | null) => {
    try {
      await api.patch(`/tickets/${id}/assign`, { assignedToId });
      invalidate();
    } catch {
      toast.error('Erreur lors de l\'assignation');
    }
  }, [id, invalidate]);

  const handleAction = useCallback(async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      const statusMap = { close: 'CLOSED', reopen: 'OPEN' };
      await api.patch(`/tickets/${id}/status`, { status: statusMap[confirmAction] });
      invalidate();
      toast.success('Statut mis à jour');
    } catch {
      toast.error('Erreur lors de l\'action');
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  }, [confirmAction, id, invalidate]);

  const handleClosingNote = useCallback(async () => {
    if (!closingNote.trim()) return;
    setClosingLoading(true);
    try {
      await api.patch(`/tickets/${id}/status`, { status: 'CLOSED', closingNote: closingNote.trim() });
      invalidate();
      toast.success('Ticket fermé');
      setClosingNoteOpen(false);
      setClosingNote('');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erreur lors de la fermeture');
    } finally {
      setClosingLoading(false);
    }
  }, [closingNote, id, invalidate]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-[65%_35%] gap-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="text-center py-24">
        <p className="text-muted-foreground">Ticket introuvable.</p>
        <Button variant="ghost" onClick={() => navigate('/tickets')} className="mt-4">
          Retour aux tickets
        </Button>
      </div>
    );
  }

  // Build mixed timeline
  const timeline: TimelineItem[] = [
    ...ticket.activityLogs.map(log => ({
      id: `log-${log.id}`,
      type: 'activity' as const,
      createdAt: log.createdAt,
      data: log,
    })),
    ...ticket.comments.map(c => ({
      id: `comment-${c.id}`,
      type: 'comment' as const,
      createdAt: c.createdAt,
      data: c,
    })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const canEdit = can('tickets.edit');
  const canClose = can('tickets.close');
  const canAssign = can('tickets.assign');
  const canDeleteAnyComment = can('comments.deleteAny');

  const actionLabels = {
    close: { title: 'Fermer le ticket', description: 'Le ticket sera fermé définitivement.' },
    reopen: { title: 'Rouvrir le ticket', description: 'Le ticket sera rouvert.' },
  };

  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-6">
        {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
        <div className="space-y-6 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link to="/tickets" className="hover:text-foreground">Tickets</Link>
                <span>/</span>
                <span className="font-mono">{ticket.ticketNumber}</span>
              </div>
              <InlineTitle
                value={ticket.title}
                onSave={v => updateField({ title: v })}
                canEdit={canEdit}
              />
              <div className="flex items-center gap-2">
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="border rounded-lg p-4 space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Description</h3>
            <InlineDescription
              value={ticket.description}
              onSave={v => updateField({ description: v })}
              canEdit={canEdit}
            />
          </div>

          {/* Timeline */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Activité & commentaires
            </h3>
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Aucune activité pour ce ticket.</p>
            ) : (
              <Timeline
                items={timeline}
                currentUserId={currentUser?.id ?? ''}
                canDeleteAny={canDeleteAnyComment}
              />
            )}
          </div>

          {/* Comment input */}
          <CommentInput ticketId={ticket.id} onAdded={invalidate} />
        </div>

        {/* ── RIGHT COLUMN ────────────────────────────────────────────────── */}
        <div className="space-y-5 lg:sticky lg:top-6 self-start">

          {/* Status, priority, category, assign */}
          <div className="border rounded-lg p-4 space-y-4">

            <FieldRow label="Statut">
              <select
                value={ticket.status}
                onChange={e => {
                  if (e.target.value === 'CLOSED') {
                    setClosingNote('');
                    setClosingNoteOpen(true);
                    // Reset select to current status (dialog handles it)
                    e.target.value = ticket.status;
                  } else {
                    updateStatus(e.target.value);
                  }
                }}
                disabled={!canEdit}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                {['OPEN', 'IN_PROGRESS', 'PENDING', 'CLOSED'].map(s => (
                  <option key={s} value={s}>
                    {s === 'OPEN' ? 'Ouvert' :
                     s === 'IN_PROGRESS' ? 'En cours' :
                     s === 'PENDING' ? 'En attente' : 'Fermé'}
                  </option>
                ))}
              </select>
            </FieldRow>

            <FieldRow label="Priorité">
              <select
                value={ticket.priority}
                onChange={e => updateField({ priority: e.target.value })}
                disabled={!canEdit}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                <option value="CRITICAL">Critique</option>
                <option value="HIGH">Haute</option>
                <option value="MEDIUM">Moyenne</option>
                <option value="LOW">Basse</option>
              </select>
            </FieldRow>

            <FieldRow label="Catégorie">
              <select
                value={ticket.category?.id ?? ''}
                onChange={e => updateField({ categoryId: e.target.value || null })}
                disabled={!canEdit}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                <option value="">Sans catégorie</option>
                {categories?.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </FieldRow>

            {/* Materiel field for pmateriel category */}
            {(() => {
              const selectedCat = categories?.find(c => c.id === ticket.category?.id);
              const isPmateriel = selectedCat?.slug?.toLowerCase() === 'pmateriel'
                || ticket.category?.slug?.toLowerCase() === 'pmateriel';
              if (!isPmateriel || !canEdit) return null;
              return (
                <FieldRow label="Materiel concerne (optionnel)">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={materialDetail}
                      onChange={e => setMaterialDetail(e.target.value)}
                      placeholder="Ex: Ecran Dell P2422H, Switch HP 1820..."
                      className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!materialDetail.trim()}
                      onClick={() => {
                        if (!materialDetail.trim()) return;
                        const append = `\n\n**Materiel concerne :** ${materialDetail.trim()}`;
                        updateField({ description: (ticket.description ?? '') + append });
                        setMaterialDetail('');
                        toast.success('Materiel ajoute a la description');
                      }}
                    >
                      Ajouter
                    </Button>
                  </div>
                </FieldRow>
              );
            })()}

            <FieldRow label="Assigné à">
              <select
                value={ticket.assignedTo?.id ?? ''}
                onChange={e => updateAssign(e.target.value || null)}
                disabled={!canAssign}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                <option value="">Non assigné</option>
                {agents?.map(a => (
                  <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
                ))}
              </select>
            </FieldRow>
          </div>

          <Separator />

          {/* Client card */}
          {ticket.client && (
            <>
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
                    style={{ backgroundColor: stringToColor(`${ticket.client.firstName} ${ticket.client.lastName}`) }}
                  >
                    {getInitials(ticket.client.firstName, ticket.client.lastName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{ticket.client.firstName} {ticket.client.lastName}</p>
                    {ticket.client.company && (
                      <p className="text-sm text-muted-foreground">{ticket.client.company}</p>
                    )}
                    {ticket.client.role && (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white mt-1"
                        style={{ backgroundColor: ticket.client.role.color }}
                      >
                        {ticket.client.role.name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  {ticket.client.phone && (
                    <a href={`tel:${ticket.client.phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      {ticket.client.phone}
                    </a>
                  )}
                  {ticket.client.email && (
                    <a href={`mailto:${ticket.client.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      {ticket.client.email}
                    </a>
                  )}
                </div>
                {(ticket.client.organisation || ticket.client.club || ticket.client.pole) && (
                  <div className="space-y-1 text-sm border-t pt-2">
                    {ticket.client.organisation && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Organisation</span>
                        <span className="font-medium">{ticket.client.organisation.name}</span>
                      </div>
                    )}
                    {ticket.client.club && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Club / Ville</span>
                        <span className="font-medium">{ticket.client.club.name}</span>
                      </div>
                    )}
                    {ticket.client.pole && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Pole</span>
                        <span className="font-medium">{ticket.client.pole.name}</span>
                      </div>
                    )}
                  </div>
                )}
                <Link
                  to={`/clients/${ticket.client.id}`}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Voir la fiche client
                </Link>
              </div>
              <Separator />
            </>
          )}

          {/* Ticket info */}
          <div className="border rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Numéro</span>
              <span className="font-mono font-medium">{ticket.ticketNumber}</span>
            </div>
            {ticket.createdBy && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Créé par</span>
                <span>{ticket.createdBy.firstName} {ticket.createdBy.lastName}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Créé le</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-default">{relativeTime(ticket.createdAt)}</span>
                </TooltipTrigger>
                <TooltipContent>{formatDate(ticket.createdAt)}</TooltipContent>
              </Tooltip>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mis à jour</span>
              <span>{relativeTime(ticket.updatedAt)}</span>
            </div>
            {ticket.resolvedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Résolu le</span>
                <span>{formatDate(ticket.resolvedAt)}</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            {canClose && ['OPEN', 'IN_PROGRESS', 'PENDING'].includes(ticket.status) && (
              <Button
                variant="outline"
                className="w-full border-gray-400 text-gray-600 hover:bg-gray-50"
                onClick={() => { setClosingNote(''); setClosingNoteOpen(true); }}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Fermer
              </Button>
            )}
            {canEdit && ticket.status === 'CLOSED' && (
              <Button
                variant="outline"
                className="w-full border-blue-500 text-blue-700 hover:bg-blue-50"
                onClick={() => setConfirmAction('reopen')}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Rouvrir
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Action confirm dialog (reopen only) */}
      {confirmAction && (
        <ConfirmDialog
          open
          onOpenChange={open => !open && setConfirmAction(null)}
          title={actionLabels[confirmAction].title}
          description={actionLabels[confirmAction].description}
          confirmLabel="Confirmer"
          loading={actionLoading}
          onConfirm={handleAction}
        />
      )}

      {/* Closing note dialog */}
      <Dialog open={closingNoteOpen} onOpenChange={open => { if (!open) { setClosingNoteOpen(false); setClosingNote(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cloture du ticket</DialogTitle>
            <DialogDescription>
              Veuillez fournir une note de fermeture avant de clore ce ticket.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Note de fermeture <span className="text-destructive">*</span>
            </label>
            <textarea
              value={closingNote}
              onChange={e => setClosingNote(e.target.value)}
              placeholder="Decrivez la resolution ou la raison de la fermeture..."
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setClosingNoteOpen(false); setClosingNote(''); }}>
              Annuler
            </Button>
            <Button
              onClick={handleClosingNote}
              disabled={!closingNote.trim() || closingLoading}
            >
              {closingLoading ? 'Fermeture...' : 'Confirmer la fermeture'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </TooltipProvider>
  );
}
