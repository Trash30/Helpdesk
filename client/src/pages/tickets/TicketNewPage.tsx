import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Plus, X, Upload, FileText, Image as ImageIcon,
  File,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/axios';
import { useClientPanel } from '@/contexts/ClientPanelContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ── helpers ──────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [d, setD] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setD(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return d;
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return ImageIcon;
  if (mimeType === 'application/pdf') return FileText;
  return File;
}

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'text/plain',
];

// ── types ────────────────────────────────────────────────────────────────────

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  role: { id: string; name: string; color: string } | null;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Agent {
  id: string;
  firstName: string;
  lastName: string;
}

interface ClientRole {
  id: string;
  name: string;
  color: string;
}

// ── Client search component ──────────────────────────────────────────────────

interface ClientSearchProps {
  selectedClient: Client | null;
  onSelect: (client: Client) => void;
  onClear: () => void;
}

function ClientSearch({ selectedClient, onSelect, onClear }: ClientSearchProps) {
  const { openClientPanel } = useClientPanel();
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const containerRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    function outside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  const { data: results, isLoading: searching } = useQuery<{ data: Client[] }>({
    queryKey: ['clients-search', debouncedQuery],
    queryFn: async () => (await api.get(`/clients?search=${encodeURIComponent(debouncedQuery)}&limit=5`)).data,
    enabled: debouncedQuery.length >= 1,
  });

  // Create client form state
  const [createForm, setCreateForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    company: '',
    roleId: '',
    isSurveyable: true,
  });

  const { data: clientRoles } = useQuery<ClientRole[]>({
    queryKey: ['client-roles-public'],
    queryFn: async () => (await api.get('/client-roles')).data?.data ?? [],
  });

  const queryClient = useQueryClient();
  const createMutation = useMutation({
    mutationFn: (data: typeof createForm) => api.post('/clients', data),
    onSuccess: (res) => {
      onSelect(res.data.data);
      setShowCreateForm(false);
      setQuery('');
      queryClient.invalidateQueries({ queryKey: ['clients-search'] });
      toast.success('Client créé');
    },
    onError: () => toast.error('Erreur lors de la création du client'),
  });

  if (selectedClient) {
    return (
      <div className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30">
        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
          {getInitials(selectedClient.firstName, selectedClient.lastName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium">{selectedClient.firstName} {selectedClient.lastName}</div>
          {selectedClient.company && <div className="text-sm text-muted-foreground">{selectedClient.company}</div>}
          {selectedClient.phone && <div className="text-sm text-muted-foreground">{selectedClient.phone}</div>}
          {selectedClient.role && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white mt-1"
              style={{ backgroundColor: selectedClient.role.color }}
            >
              {selectedClient.role.name}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClear}>Changer</Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openClientPanel(selectedClient.id)}
          >
            Modifier
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-3">
      {!showCreateForm && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher un client par nom, email, téléphone..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => query.length >= 1 && setShowDropdown(true)}
            onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
            className="w-full h-10 pl-9 pr-4 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {showDropdown && debouncedQuery.length >= 1 && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-md border bg-popover shadow-md overflow-hidden">
              {searching ? (
                <div className="px-4 py-3 text-sm text-muted-foreground">Recherche...</div>
              ) : (results?.data ?? []).length === 0 ? (
                <div className="px-4 py-3 text-sm">
                  <p className="text-muted-foreground mb-2">Aucun client trouvé pour « {debouncedQuery} »</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowDropdown(false);
                      setShowCreateForm(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Créer ce client
                  </Button>
                </div>
              ) : (
                (results?.data ?? []).map(client => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => {
                      onSelect(client);
                      setShowDropdown(false);
                      setQuery('');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent text-left"
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
                      {getInitials(client.firstName, client.lastName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{client.firstName} {client.lastName}</div>
                      <div className="text-xs text-muted-foreground flex gap-2">
                        {client.company && <span>{client.company}</span>}
                        {client.phone && <span>{client.phone}</span>}
                      </div>
                    </div>
                    {client.role && (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white shrink-0"
                        style={{ backgroundColor: client.role.color }}
                      >
                        {client.role.name}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Inline creation form */}
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: showCreateForm ? '600px' : '0', opacity: showCreateForm ? 1 : 0 }}
      >
        <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Créer un nouveau client</h4>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Prénom *</Label>
              <Input
                value={createForm.firstName}
                onChange={e => setCreateForm(f => ({ ...f, firstName: e.target.value }))}
                placeholder="Prénom"
                className="h-9 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Nom *</Label>
              <Input
                value={createForm.lastName}
                onChange={e => setCreateForm(f => ({ ...f, lastName: e.target.value }))}
                placeholder="Nom"
                className="h-9 text-sm mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Téléphone</Label>
              <Input
                value={createForm.phone}
                onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="Téléphone"
                className="h-9 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={createForm.email}
                onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                placeholder="Email"
                className="h-9 text-sm mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Société</Label>
              <Input
                value={createForm.company}
                onChange={e => setCreateForm(f => ({ ...f, company: e.target.value }))}
                placeholder="Société"
                className="h-9 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Rôle client</Label>
              <select
                value={createForm.roleId}
                onChange={e => setCreateForm(f => ({ ...f, roleId: e.target.value }))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm mt-1 focus:outline-none"
              >
                <option value="">Aucun rôle</option>
                {clientRoles?.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={createForm.isSurveyable}
              onCheckedChange={v => setCreateForm(f => ({ ...f, isSurveyable: v }))}
              id="create-surveyable"
            />
            <Label htmlFor="create-surveyable" className="text-sm cursor-pointer">
              Enquêtes de satisfaction
            </Label>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              disabled={!createForm.firstName || !createForm.lastName || createMutation.isPending}
              onClick={() => createMutation.mutate(createForm)}
            >
              {createMutation.isPending ? 'Création...' : 'Créer et sélectionner'}
            </Button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>

      {!showCreateForm && (
        <button
          type="button"
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <Plus className="h-3.5 w-3.5" />
          Créer un nouveau client
        </button>
      )}
    </div>
  );
}

// ── Attachment drop zone ─────────────────────────────────────────────────────

interface AttachmentZoneProps {
  files: File[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
}

function AttachmentZone({ files, onAdd, onRemove }: AttachmentZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndAdd = (newFiles: File[]) => {
    const errors: string[] = [];
    const valid: File[] = [];

    for (const f of newFiles) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        errors.push(`${f.name}: type non autorisé`);
      } else if (f.size > 10 * 1024 * 1024) {
        errors.push(`${f.name}: dépasse 10 Mo`);
      } else if (files.length + valid.length >= 5) {
        errors.push('Maximum 5 fichiers');
        break;
      } else {
        valid.push(f);
      }
    }

    if (errors.length) toast.error(errors[0]);
    if (valid.length) onAdd(valid);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    validateAndAdd(Array.from(e.dataTransfer.files));
  }, [files]);

  return (
    <div className="space-y-3">
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-muted-foreground/50'}`}
      >
        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Déposez vos fichiers ici ou <span className="text-primary underline">cliquez pour sélectionner</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Images, PDF, DOC, DOCX, ZIP, TXT — max 5 fichiers, 10 Mo chacun
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ALLOWED_TYPES.join(',')}
          className="hidden"
          onChange={e => {
            if (e.target.files) validateAndAdd(Array.from(e.target.files));
            e.target.value = '';
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, i) => {
            const Icon = getFileIcon(file.type);
            return (
              <li key={i} className="flex items-center gap-3 p-2 rounded-md border bg-muted/30">
                {file.type.startsWith('image/') ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="h-8 w-8 object-cover rounded"
                  />
                ) : (
                  <Icon className="h-8 w-8 text-muted-foreground" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{file.name}</div>
                  <div className="text-xs text-muted-foreground">{formatBytes(file.size)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export function TicketNewPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preloadClientId = searchParams.get('clientId');

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Pre-load client from URL query param
  useEffect(() => {
    if (preloadClientId && !selectedClient) {
      api.get(`/clients/${preloadClientId}`).then(res => {
        setSelectedClient(res.data.data);
      }).catch(() => {/* ignore */});
    }
  }, [preloadClientId]);
  const [clientError, setClientError] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [assignedToId, setAssignedToId] = useState('');
  const [poleId, setPoleId] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);

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
  });

  const { data: poles } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['poles'],
    queryFn: async () => (await api.get('/poles')).data?.data ?? [],
  });

  const queryClient = useQueryClient();
  const createMutation = useMutation({
    mutationFn: async (vars: {
      clientId: string; title: string; description: string;
      categoryId: string; priority: string; assignedToId: string; poleId: string;
      attachments: File[];
    }) => {
      // Step 1 — create ticket with JSON
      const res = await api.post('/tickets', {
        clientId: vars.clientId,
        title: vars.title,
        description: vars.description || undefined,
        categoryId: vars.categoryId || undefined,
        priority: vars.priority,
        assignedToId: vars.assignedToId || undefined,
        poleId: vars.poleId || undefined,
      });
      const ticket = res.data.data;

      // Step 2 — upload attachments as first comment if any
      if (vars.attachments.length > 0) {
        const formData = new FormData();
        formData.append('content', '');
        formData.append('isInternal', 'false');
        vars.attachments.forEach(f => formData.append('files', f));
        await api.post(`/tickets/${ticket.id}/comments`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      return ticket;
    },
    onSuccess: (ticket) => {
      toast.success(`Ticket ${ticket.ticketNumber} créé !`);
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      navigate(`/tickets/${ticket.id}`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? 'Erreur lors de la création');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClient) {
      setClientError('Veuillez sélectionner ou créer un client');
      return;
    }
    setClientError('');

    createMutation.mutate({
      clientId: selectedClient.id,
      title,
      description,
      categoryId,
      priority,
      assignedToId,
      poleId,
      attachments,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nouveau ticket</h1>
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate(-1)}
        >
          Annuler
        </Button>
      </div>

      {/* Client section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Client</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientSearch
            selectedClient={selectedClient}
            onSelect={c => { setSelectedClient(c); setClientError(''); }}
            onClear={() => setSelectedClient(null)}
          />
          {clientError && (
            <p className="text-sm text-destructive mt-2">{clientError}</p>
          )}
        </CardContent>
      </Card>

      {/* Ticket details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Détails du ticket</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Titre *</Label>
            <Input
              id="title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Titre du ticket"
              autoFocus
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Description du problème... (Markdown supporté)"
              rows={4}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            />
            <p className="text-xs text-muted-foreground mt-1">Markdown supporté : **gras**, *italique*, `code`</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Catégorie</Label>
              <select
                id="category"
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Sans catégorie</option>
                {categories?.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="priority">Priorité</Label>
              <select
                id="priority"
                value={priority}
                onChange={e => setPriority(e.target.value)}
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="CRITICAL">Critique</option>
                <option value="HIGH">Haute</option>
                <option value="MEDIUM">Moyenne</option>
                <option value="LOW">Basse</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="assignedTo">Assigner à</Label>
              <select
                id="assignedTo"
                value={assignedToId}
                onChange={e => setAssignedToId(e.target.value)}
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Non assigné</option>
                {agents?.map(a => (
                  <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="pole">Pôle</Label>
              <select
                id="pole"
                value={poleId}
                onChange={e => setPoleId(e.target.value)}
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Aucun pôle</option>
                {poles?.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attachments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pièces jointes</CardTitle>
        </CardHeader>
        <CardContent>
          <AttachmentZone
            files={attachments}
            onAdd={newFiles => setAttachments(prev => [...prev, ...newFiles])}
            onRemove={i => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
          />
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-3 pb-6">
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>
          Annuler
        </Button>
        <Button type="submit" disabled={createMutation.isPending || !title.trim()}>
          {createMutation.isPending ? 'Création en cours...' : 'Créer le ticket'}
        </Button>
      </div>
    </form>
  );
}
