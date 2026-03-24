import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Pencil, Trash2 } from 'lucide-react';
import api from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

interface Organisation {
  id: string;
  name: string;
}

interface Club {
  id: string;
  name: string;
  organisationId: string;
  organisation?: Organisation;
  isActive: boolean;
  position: number;
  _count?: { clients: number };
}

function SortableRow({
  item, onEdit, onDelete,
}: { item: Club; onEdit: (c: Club) => void; onDelete: (c: Club) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}
      className="flex items-center gap-3 p-3 bg-card border rounded-lg group">
      <button {...listeners} {...attributes}
        className="cursor-grab text-muted-foreground hover:text-foreground touch-none">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <span className="font-medium text-sm">{item.name}</span>
        {item.organisation && (
          <span className="text-xs text-muted-foreground ml-2">({item.organisation.name})</span>
        )}
      </div>
      <span className={`text-xs px-1.5 py-0.5 rounded ${
        item.isActive ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
      }`}>
        {item.isActive ? 'Actif' : 'Inactif'}
      </span>
      <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(item)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => onDelete(item)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

const defaultForm = { name: '', organisationId: '', isActive: true };

export function AdminClubsPage() {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<Club[]>([]);
  const [filterOrgId, setFilterOrgId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Club | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Club | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data } = useQuery<{ data: Club[] }>({
    queryKey: ['admin-clubs', filterOrgId],
    queryFn: async () => {
      const params = filterOrgId ? `?organisationId=${filterOrgId}` : '';
      return (await api.get(`/admin/clubs${params}`)).data;
    },
  });

  const { data: orgsData } = useQuery<{ data: Organisation[] }>({
    queryKey: ['admin-organisations'],
    queryFn: async () => (await api.get('/admin/organisations')).data,
  });
  const organisations = orgsData?.data ?? [];

  useEffect(() => {
    if (data?.data) setItems(data.data);
  }, [data]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex(i => i.id === active.id);
    const newIndex = items.findIndex(i => i.id === over.id);
    const newItems = arrayMove(items, oldIndex, newIndex);
    setItems(newItems);
    try {
      await api.patch('/admin/clubs/reorder',
        newItems.map((item, idx) => ({ id: item.id, position: idx + 1 }))
      );
    } catch {
      toast.error('Erreur lors du reordonnancement');
      queryClient.invalidateQueries({ queryKey: ['admin-clubs'] });
    }
  };

  const openCreate = () => {
    setEditTarget(null);
    setForm(defaultForm);
    setModalOpen(true);
  };

  const openEdit = (club: Club) => {
    setEditTarget(club);
    setForm({
      name: club.name,
      organisationId: club.organisationId,
      isActive: club.isActive,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Le nom est requis'); return; }
    if (!form.organisationId) { toast.error('L\'organisation est requise'); return; }
    setSaving(true);
    try {
      if (editTarget) {
        await api.put(`/admin/clubs/${editTarget.id}`, form);
        toast.success('Club mis a jour');
      } else {
        await api.post('/admin/clubs', form);
        toast.success('Club cree');
      }
      queryClient.invalidateQueries({ queryKey: ['admin-clubs'] });
      setModalOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Erreur lors de la sauvegarde');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/clubs/${deleteTarget.id}`);
      toast.success('Club supprime');
      queryClient.invalidateQueries({ queryKey: ['admin-clubs'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Erreur lors de la suppression');
    } finally { setDeleting(false); setDeleteTarget(null); }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clubs / Villes</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />Nouveau club
        </Button>
      </div>

      {/* Organisation filter */}
      <div>
        <select
          value={filterOrgId}
          onChange={e => setFilterOrgId(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
        >
          <option value="">Toutes les organisations</option>
          {organisations.map(o => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map(item => (
              <SortableRow key={item.id} item={item}
                onEdit={openEdit}
                onDelete={() => setDeleteTarget(item)}
              />
            ))}
            {items.length === 0 && (
              <p className="text-center text-muted-foreground py-12">
                Aucun club. Creez-en un pour commencer.
              </p>
            )}
          </div>
        </SortableContext>
      </DndContext>

      <Dialog open={modalOpen} onOpenChange={open => { if (!saving) setModalOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Modifier le club' : 'Nouveau club'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nom <span className="text-destructive">*</span></Label>
              <Input value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nom du club" className="mt-1" />
            </div>
            <div>
              <Label>Organisation <span className="text-destructive">*</span></Label>
              <select
                value={form.organisationId}
                onChange={e => setForm(f => ({ ...f, organisationId: e.target.value }))}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
              >
                <option value="">Selectionner une organisation</option>
                {organisations.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="club-active" checked={form.isActive}
                onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
              <Label htmlFor="club-active">Actif</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Enregistrement...' : (editTarget ? 'Enregistrer' : 'Creer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title="Supprimer le club"
        description={
          deleteTarget?._count?.clients
            ? `Ce club est utilise par ${deleteTarget._count.clients} client(s) et ne peut pas etre supprime.`
            : `Supprimer le club "${deleteTarget?.name}" ? Cette action est irreversible.`
        }
        confirmLabel={deleteTarget?._count?.clients ? 'Fermer' : 'Supprimer'}
        variant={deleteTarget?._count?.clients ? 'default' : 'destructive'}
        loading={deleting}
        onConfirm={deleteTarget?._count?.clients ? () => setDeleteTarget(null) : handleDelete}
      />
    </div>
  );
}
