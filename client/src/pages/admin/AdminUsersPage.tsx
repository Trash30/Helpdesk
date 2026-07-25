import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import api from '@/lib/axios';
import { getInitials } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { PasswordStrength } from '@/components/ui/PasswordStrength';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';

// Permission groups for read-only preview
const PERMISSION_GROUPS = [
  {
    key: 'tickets', label: 'Tickets',
    permissions: [
      { key: 'tickets.view', label: 'Voir les tickets' },
      { key: 'tickets.create', label: 'Créer un ticket' },
      { key: 'tickets.edit', label: 'Modifier un ticket' },
      { key: 'tickets.close', label: 'Fermer / résoudre un ticket' },
      { key: 'tickets.delete', label: 'Supprimer un ticket' },
      { key: 'tickets.assign', label: 'Assigner un ticket' },
      { key: 'tickets.viewAll', label: 'Voir tous les tickets' },
    ],
  },
  {
    key: 'clients', label: 'Clients',
    permissions: [
      { key: 'clients.view', label: 'Voir les clients' },
      { key: 'clients.create', label: 'Créer un client' },
      { key: 'clients.edit', label: 'Modifier un client' },
      { key: 'clients.delete', label: 'Supprimer un client' },
    ],
  },
  {
    key: 'comments', label: 'Commentaires',
    permissions: [
      { key: 'comments.create', label: 'Ajouter un commentaire' },
      { key: 'comments.delete', label: 'Supprimer ses commentaires' },
      { key: 'comments.deleteAny', label: 'Supprimer tout commentaire' },
    ],
  },
  {
    key: 'surveys', label: 'Enquêtes',
    permissions: [
      { key: 'surveys.view', label: 'Voir les résultats' },
      { key: 'surveys.configure', label: 'Configurer le modèle' },
    ],
  },
  {
    key: 'admin', label: 'Administration',
    permissions: [
      { key: 'admin.access', label: 'Accéder au panneau admin' },
      { key: 'admin.users', label: 'Gérer les agents' },
      { key: 'admin.roles', label: 'Gérer les rôles' },
      { key: 'admin.categories', label: 'Gérer les catégories' },
      { key: 'admin.clientRoles', label: 'Gérer les rôles clients' },
      { key: 'admin.settings', label: 'Modifier les paramètres' },
    ],
  },
];

interface Role { id: string; name: string; permissions: string[] }

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  role: Role;
  _count?: { assignedTickets: number };
}

const defaultForm = {
  firstName: '', lastName: '', email: '',
  password: '', roleId: '', isActive: true,
};

export function AdminUsersPage() {
  const { t } = useTranslation('admin');
  const queryClient = useQueryClient();
  const currentUser = useAuthStore(s => s.user);
  const [filterRole, setFilterRole] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: usersData } = useQuery<{ data: User[] }>({
    queryKey: ['admin-users', filterRole],
    queryFn: async () => (await api.get('/admin/users', { params: filterRole ? { roleId: filterRole } : {} })).data,
  });
  const { data: rolesData } = useQuery<{ data: Role[] }>({
    queryKey: ['admin-roles'],
    queryFn: async () => (await api.get('/admin/roles')).data,
  });

  const users = usersData?.data ?? [];
  const roles = rolesData?.data ?? [];
  const selectedRole = roles.find(r => r.id === form.roleId);

  const openCreate = () => {
    setEditTarget(null);
    setForm(defaultForm);
    setShowPassword(false);
    setSheetOpen(true);
  };

  const openEdit = (user: User) => {
    setEditTarget(user);
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: '',
      roleId: user.role.id,
      isActive: user.isActive,
    });
    setShowPassword(false);
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error(t('users.firstLastRequired')); return;
    }
    if (!form.email.trim()) { toast.error(t('users.emailRequired')); return; }
    if (!form.roleId) { toast.error(t('users.roleRequired')); return; }
    if (!editTarget && !form.password) { toast.error(t('users.passwordRequired')); return; }

    setSaving(true);
    try {
      if (editTarget) {
        const body: any = {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          roleId: form.roleId,
          isActive: form.isActive,
        };
        await api.put(`/admin/users/${editTarget.id}`, body);
        toast.success(t('users.agentUpdated'));
      } else {
        await api.post('/admin/users', {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          password: form.password,
          roleId: form.roleId,
          isActive: form.isActive,
        });
        toast.success(t('users.agentCreated'));
      }
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setSheetOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? t('users.saveError'));
    } finally { setSaving(false); }
  };

  const handleSendReset = async () => {
    if (!editTarget) return;
    setSendingReset(true);
    try {
      await api.post(`/admin/users/${editTarget.id}/send-reset-email`);
      toast.success(t('users.emailSent', { email: editTarget.email }));
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? t('users.sendError'));
    } finally { setSendingReset(false); setConfirmReset(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/users/${deleteTarget.id}`);
      toast.success(t('users.agentDeleted'));
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? t('users.deleteError'));
    } finally { setDeleting(false); setDeleteTarget(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t('users.title')}</h1>
        <div className="flex items-center gap-2">
          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none">
            <option value="">{t('users.allRoles')}</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />{t('users.newAgent')}
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left p-3 font-medium">{t('users.colAgent')}</th>
              <th className="text-left p-3 font-medium">{t('users.colEmail')}</th>
              <th className="text-left p-3 font-medium">{t('users.colRole')}</th>
              <th className="text-left p-3 font-medium">{t('users.colTickets')}</th>
              <th className="text-left p-3 font-medium">{t('users.colStatus')}</th>
              <th className="w-10 p-3" />
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {getInitials(user.firstName, user.lastName)}
                    </div>
                    <span className="font-medium">{user.firstName} {user.lastName}</span>
                  </div>
                </td>
                <td className="p-3 text-muted-foreground">{user.email}</td>
                <td className="p-3">
                  <span className="text-xs px-2 py-0.5 rounded-full border font-medium">
                    {user.role.name}
                  </span>
                </td>
                <td className="p-3 text-muted-foreground">
                  {user._count?.assignedTickets ?? 0}
                </td>
                <td className="p-3">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    user.isActive ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
                  }`}>
                    {user.isActive ? t('users.active') : t('users.inactive')}
                  </span>
                </td>
                <td className="p-3 flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => openEdit(user)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {currentUser?.id !== user.id && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(user)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  {t('users.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Slide-over */}
      <Sheet open={sheetOpen} onOpenChange={open => { if (!saving) setSheetOpen(open); }}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col overflow-hidden">
          <SheetHeader>
            <SheetTitle>
              {editTarget
                ? `${editTarget.firstName} ${editTarget.lastName}`
                : t('users.newAgent')}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('users.firstName')} <span className="text-destructive">*</span></Label>
                <Input value={form.firstName}
                  onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                  className="mt-1" />
              </div>
              <div>
                <Label>{t('users.lastName')} <span className="text-destructive">*</span></Label>
                <Input value={form.lastName}
                  onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                  className="mt-1" />
              </div>
            </div>

            <div>
              <Label>{t('users.email')} <span className="text-destructive">*</span></Label>
              <Input type="email" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="mt-1" />
            </div>

            {!editTarget && (
              <div>
                <Label>{t('users.password')} <span className="text-destructive">*</span></Label>
                <div className="relative mt-1">
                  <Input type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder={t('users.passwordPlaceholder')}
                    className="pr-10" />
                  <button type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <PasswordStrength password={form.password} />
              </div>
            )}

            <div>
              <Label>{t('users.role')} <span className="text-destructive">*</span></Label>
              <select value={form.roleId}
                onChange={e => setForm(f => ({ ...f, roleId: e.target.value }))}
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none">
                <option value="">{t('users.selectRole')}</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Switch id="user-active" checked={form.isActive}
                onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
              <Label htmlFor="user-active">{t('users.accountActive')}</Label>
            </div>

            {/* Permissions preview (read-only) */}
            {selectedRole && (
              <>
                <Separator />
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">
                    {t('users.rolePermissionsReadonly')}
                  </p>
                  {PERMISSION_GROUPS.map(group => (
                    <div key={group.key} className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {group.label}
                      </p>
                      {group.permissions.map(perm => (
                        <label key={perm.key} className="flex items-center gap-2 opacity-70">
                          <input type="checkbox"
                            checked={selectedRole.permissions.includes(perm.key)}
                            disabled
                            className="h-4 w-4 rounded border-input" />
                          <span className="text-xs">{perm.label}</span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Reset email button (edit only) */}
            {editTarget && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Button
                    variant="outline" className="w-full"
                    onClick={() => setConfirmReset(true)}
                    disabled={sendingReset}>
                    {t('users.sendResetEmail')}
                  </Button>
                </div>
              </>
            )}
          </div>

          <div className="border-t pt-4 flex gap-2">
            <Button variant="outline" className="flex-1"
              onClick={() => setSheetOpen(false)} disabled={saving}>
              {t('users.cancel')}
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? t('users.saving') : (editTarget ? t('users.save') : t('users.create'))}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={open => !open && setConfirmReset(false)}
        title={t('users.confirmResetTitle')}
        description={t('users.confirmResetDesc', { email: editTarget?.email })}
        confirmLabel={t('users.send')}
        loading={sendingReset}
        onConfirm={handleSendReset}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={open => { if (!open) setDeleteTarget(null); }}
        title={t('users.deleteTitle')}
        description={deleteTarget ? t('users.deleteConfirm', { name: `${deleteTarget.firstName} ${deleteTarget.lastName}` }) : ''}
        confirmLabel={t('users.delete')}
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
