import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Copy, Trash2, Pencil, Shield, Ticket, Users, MessageSquare, BarChart2, BookOpen } from 'lucide-react';
import api from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';

// Permission groups (mirrors server config)
const PERMISSION_GROUPS = [
  {
    key: 'tickets', label: 'Tickets', Icon: Ticket,
    permissions: [
      { key: 'tickets.view', label: 'Voir les tickets', description: 'Accès à la liste et au détail des tickets' },
      { key: 'tickets.create', label: 'Créer un ticket', description: 'Créer de nouveaux tickets' },
      { key: 'tickets.edit', label: 'Modifier un ticket', description: 'Éditer le titre, la description, la priorité...' },
      { key: 'tickets.close', label: 'Fermer un ticket', description: 'Passer un ticket en CLOSED' },
      { key: 'tickets.delete', label: 'Supprimer un ticket', description: 'Supprimer définitivement un ticket' },
      { key: 'tickets.assign', label: 'Assigner un ticket', description: "Assigner un ticket à un agent" },
      { key: 'tickets.viewAll', label: 'Voir tous les tickets', description: "Sans ce droit, l'agent ne voit que ses tickets assignés" },
    ],
  },
  {
    key: 'clients', label: 'Clients', Icon: Users,
    permissions: [
      { key: 'clients.view', label: 'Voir les clients', description: 'Accès à la liste et aux fiches clients' },
      { key: 'clients.create', label: 'Créer un client', description: 'Ajouter de nouveaux clients' },
      { key: 'clients.edit', label: 'Modifier un client', description: 'Éditer les informations client' },
      { key: 'clients.delete', label: 'Supprimer un client', description: 'Supprimer un client (bloqué si tickets ouverts)' },
    ],
  },
  {
    key: 'comments', label: 'Commentaires', Icon: MessageSquare,
    permissions: [
      { key: 'comments.create', label: 'Ajouter un commentaire', description: 'Poster des commentaires sur les tickets' },
      { key: 'comments.delete', label: 'Supprimer ses commentaires', description: 'Supprimer ses propres commentaires uniquement' },
      { key: 'comments.deleteAny', label: 'Supprimer tout commentaire', description: 'Supprimer les commentaires de tous les agents' },
    ],
  },
  {
    key: 'surveys', label: 'Enquêtes', Icon: BarChart2,
    permissions: [
      { key: 'surveys.view', label: 'Voir les résultats', description: 'Accéder aux résultats et statistiques des enquêtes' },
      { key: 'surveys.configure', label: 'Configurer le modèle', description: "Modifier les questions du modèle d'enquête" },
    ],
  },
  {
    key: 'kb', label: 'Base de connaissance', Icon: BookOpen,
    permissions: [
      { key: 'kb.read', label: 'Lire les articles', description: 'Accéder à la base de connaissance et lire les articles' },
      { key: 'kb.write', label: 'Créer / modifier des articles', description: 'Créer et modifier des articles dans la base de connaissance' },
      { key: 'kb.delete', label: 'Supprimer des articles', description: 'Supprimer des articles de la base de connaissance' },
    ],
  },
  {
    key: 'admin', label: 'Administration', Icon: Shield,
    permissions: [
      { key: 'admin.access', label: 'Accéder au panneau admin', description: 'Voir le menu Administration dans la sidebar' },
      { key: 'admin.users', label: 'Gérer les agents', description: 'Créer, modifier, activer/désactiver des agents' },
      { key: 'admin.roles', label: 'Gérer les rôles', description: 'Créer et modifier les rôles et leurs permissions' },
      { key: 'admin.categories', label: 'Gérer les catégories', description: 'Gérer les catégories de tickets' },
      { key: 'admin.clientRoles', label: 'Gérer les rôles clients', description: 'Gérer les rôles attribuables aux clients' },
      { key: 'admin.settings', label: 'Modifier les paramètres', description: 'Paramètres généraux, logo, branding' },
    ],
  },
];

const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.key));

// Auto-dependency rules
function applyDependencies(perms: string[], added: string): string[] {
  const set = new Set(perms);
  set.add(added);
  if (added === 'tickets.edit') { set.add('tickets.view'); }
  if (added === 'tickets.close') { set.add('tickets.view'); set.add('tickets.edit'); }
  if (added === 'tickets.delete') { set.add('tickets.view'); }
  if (added === 'tickets.assign') { set.add('tickets.view'); }
  if (added === 'comments.deleteAny') { set.add('comments.delete'); }
  if (['admin.users', 'admin.roles', 'admin.categories', 'admin.clientRoles', 'admin.settings'].includes(added)) {
    set.add('admin.access');
  }
  return [...set];
}

interface Role {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  permissions: string[];
  _count?: { users: number };
}

function countPerGroup(perms: string[]) {
  return PERMISSION_GROUPS.map(g => ({
    label: g.label,
    count: g.permissions.filter(p => perms.includes(p.key)).length,
    total: g.permissions.length,
  }));
}

export function AdminRolesPage() {
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Role | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPerms, setFormPerms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data } = useQuery<{ data: Role[] }>({
    queryKey: ['admin-roles'],
    queryFn: async () => (await api.get('/admin/roles')).data,
  });
  const roles = data?.data ?? [];

  const openCreate = () => {
    setEditTarget(null);
    setFormName('');
    setFormDesc('');
    setFormPerms([]);
    setSheetOpen(true);
  };

  const openEdit = (role: Role) => {
    setEditTarget(role);
    setFormName(role.name);
    setFormDesc(role.description ?? '');
    setFormPerms([...role.permissions]);
    setSheetOpen(true);
  };

  const togglePerm = (key: string, checked: boolean) => {
    if (checked) {
      const newPerms = applyDependencies(formPerms, key);
      const added = newPerms.filter(p => p !== key && !formPerms.includes(p));
      if (added.length > 0) {
        const names = added.map(p =>
          PERMISSION_GROUPS.flatMap(g => g.permissions).find(x => x.key === p)?.label ?? p
        );
        toast.success(`Activé automatiquement : ${names.join(', ')}`, { duration: 3000 });
      }
      setFormPerms(newPerms);
    } else {
      setFormPerms(prev => prev.filter(p => p !== key));
    }
  };

  const toggleGroup = (keys: string[], allChecked: boolean) => {
    if (allChecked) {
      setFormPerms(prev => prev.filter(p => !keys.includes(p)));
    } else {
      let perms = [...formPerms];
      keys.forEach(k => { perms = applyDependencies(perms, k); });
      setFormPerms(perms);
    }
  };

  const handleSave = async () => {
    if (!editTarget && !formName.trim()) { toast.error('Le nom est requis'); return; }
    setSaving(true);
    try {
      const body = editTarget?.isSystem
        ? { description: formDesc, permissions: formPerms }
        : { name: formName, description: formDesc, permissions: formPerms };

      if (editTarget) {
        await api.put(`/admin/roles/${editTarget.id}`, body);
        toast.success('Rôle mis à jour');
      } else {
        await api.post('/admin/roles', body);
        toast.success('Rôle créé');
      }
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      setSheetOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Erreur lors de la sauvegarde');
    } finally { setSaving(false); }
  };

  const handleDuplicate = async (role: Role) => {
    try {
      await api.post(`/admin/roles/${role.id}/duplicate`);
      toast.success(`Copie de "${role.name}" créée`);
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Erreur lors de la duplication');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/roles/${deleteTarget.id}`);
      toast.success('Rôle supprimé');
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Erreur lors de la suppression');
    } finally { setDeleting(false); setDeleteTarget(null); }
  };

  const groupCounts = countPerGroup(formPerms);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Rôles & permissions</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />Nouveau rôle
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roles.map(role => (
          <div key={role.id} className="bg-card border rounded-lg p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{role.name}</span>
                  {role.isSystem && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                      Système
                    </span>
                  )}
                </div>
                {role.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {role.description}
                  </p>
                )}
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              {role._count?.users ?? 0} agent(s)
            </div>

            {/* Permission pills preview */}
            <div className="flex flex-wrap gap-1">
              {role.permissions.slice(0, 4).map(p => (
                <span key={p} className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                  {p}
                </span>
              ))}
              {role.permissions.length > 4 && (
                <span className="text-xs text-muted-foreground">
                  +{role.permissions.length - 4}
                </span>
              )}
            </div>

            <div className="flex gap-1 mt-auto pt-2 border-t">
              <Button variant="ghost" size="sm" className="flex-1" onClick={() => openEdit(role)}>
                <Pencil className="h-3.5 w-3.5 mr-1" />Modifier
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDuplicate(role)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost" size="sm"
                className="text-destructive hover:text-destructive"
                disabled={role.isSystem || (role._count?.users ?? 0) > 0}
                title={
                  role.isSystem ? 'Rôle système non supprimable'
                  : (role._count?.users ?? 0) > 0 ? 'Des agents utilisent ce rôle'
                  : undefined
                }
                onClick={() => setDeleteTarget(role)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Slide-over editor */}
      <Sheet open={sheetOpen} onOpenChange={open => { if (!saving) setSheetOpen(open); }}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col overflow-hidden">
          <SheetHeader>
            <SheetTitle>
              {editTarget ? `Modifier "${editTarget.name}"` : 'Nouveau rôle'}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {/* Name & description */}
            <div>
              <Label>Nom <span className="text-destructive">*</span></Label>
              <Input value={formName}
                onChange={e => setFormName(e.target.value)}
                disabled={editTarget?.isSystem ?? false}
                placeholder="Nom du rôle" className="mt-1" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                placeholder="Description optionnelle" className="mt-1" />
            </div>

            <Separator />

            {/* Permission groups */}
            {PERMISSION_GROUPS.map(group => {
              const groupKeys = group.permissions.map(p => p.key);
              const allChecked = groupKeys.every(k => formPerms.includes(k));
              const someChecked = groupKeys.some(k => formPerms.includes(k));
              const { Icon } = group;
              return (
                <div key={group.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      {group.label}
                    </div>
                    <button
                      onClick={() => toggleGroup(groupKeys, allChecked)}
                      className="text-xs text-primary hover:underline">
                      {allChecked ? 'Tout décocher' : 'Tout cocher'}
                    </button>
                  </div>
                  {group.permissions.map(perm => (
                    <label key={perm.key}
                      className="flex items-start gap-2 cursor-pointer group">
                      <input type="checkbox"
                        checked={formPerms.includes(perm.key)}
                        onChange={e => togglePerm(perm.key, e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-input accent-primary" />
                      <div className="flex-1">
                        <span className="text-sm">{perm.label}</span>
                        <p className="text-xs text-muted-foreground">{perm.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Sticky footer */}
          <div className="border-t pt-4 space-y-3">
            <div className="text-xs text-muted-foreground">
              Ce rôle dispose de <strong>{formPerms.length}</strong> droit(s) sur {ALL_PERMISSIONS.length}
            </div>
            <div className="flex flex-wrap gap-1">
              {groupCounts.map(g => (
                <span key={g.label} className={`text-xs px-1.5 py-0.5 rounded ${
                  g.count > 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                  {g.label} ({g.count}/{g.total})
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1"
                onClick={() => setSheetOpen(false)} disabled={saving}>
                Annuler
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? 'Enregistrement...' : (editTarget ? 'Enregistrer' : 'Créer')}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title="Supprimer le rôle"
        description={`Supprimer le rôle "${deleteTarget?.name}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
