import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
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

interface TicketType {
  id: string;
  name: string;
  isActive: boolean;
  position: number;
  _count?: { tickets: number };
}

function SortableRow({
  item, onEdit, onDelete,
}: { item: TicketType; onEdit: (t: TicketType) => void; onDelete: (t: TicketType) => void }) {
  const { t } = useTranslation('admin');
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
      </div>
      <span className={`text-xs px-1.5 py-0.5 rounded ${
        item.isActive ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
      }`}>
        {item.isActive ? t('ticketTypes.active') : t('ticketTypes.inactive')}
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

const defaultForm = { name: '', isActive: true };

export function AdminTicketTypesPage() {
  const { t } = useTranslation('admin');
  const queryClient = useQueryClient();
  const [items, setItems] = useState<TicketType[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TicketType | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TicketType | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data } = useQuery<{ data: TicketType[] }>({
    queryKey: ['admin-ticket-types'],
    queryFn: async () => (await api.get('/admin/ticket-types')).data,
  });

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
      await api.patch('/admin/ticket-types/reorder',
        newItems.map((item, idx) => ({ id: item.id, position: idx + 1 }))
      );
    } catch {
      toast.error(t('ticketTypes.reorderError'));
      queryClient.invalidateQueries({ queryKey: ['admin-ticket-types'] });
    }
  };

  const openCreate = () => {
    setEditTarget(null);
    setForm(defaultForm);
    setModalOpen(true);
  };

  const openEdit = (tt: TicketType) => {
    setEditTarget(tt);
    setForm({ name: tt.name, isActive: tt.isActive });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error(t('ticketTypes.nameRequired')); return; }
    setSaving(true);
    try {
      if (editTarget) {
        await api.put(`/admin/ticket-types/${editTarget.id}`, form);
        toast.success(t('ticketTypes.typeUpdated'));
      } else {
        await api.post('/admin/ticket-types', form);
        toast.success(t('ticketTypes.typeCreated'));
      }
      queryClient.invalidateQueries({ queryKey: ['admin-ticket-types'] });
      setModalOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? t('ticketTypes.saveError'));
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/ticket-types/${deleteTarget.id}`);
      toast.success(t('ticketTypes.typeDeleted'));
      queryClient.invalidateQueries({ queryKey: ['admin-ticket-types'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? t('ticketTypes.deleteError'));
    } finally { setDeleting(false); setDeleteTarget(null); }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('ticketTypes.title')}</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />{t('ticketTypes.newType')}
        </Button>
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
                {t('ticketTypes.empty')}
              </p>
            )}
          </div>
        </SortableContext>
      </DndContext>

      <Dialog open={modalOpen} onOpenChange={open => { if (!saving) setModalOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? t('ticketTypes.editTitle') : t('ticketTypes.createTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{t('ticketTypes.name')} <span className="text-destructive">*</span></Label>
              <Input value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={t('ticketTypes.namePlaceholder')} className="mt-1" />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="tt-active" checked={form.isActive}
                onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
              <Label htmlFor="tt-active">{t('ticketTypes.activeLabel')}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              {t('ticketTypes.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t('ticketTypes.saving') : (editTarget ? t('ticketTypes.save') : t('ticketTypes.create'))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title={t('ticketTypes.deleteTitle')}
        description={
          deleteTarget?._count?.tickets
            ? t('ticketTypes.deleteInUse', { count: deleteTarget._count.tickets })
            : t('ticketTypes.deleteConfirm', { name: deleteTarget?.name })
        }
        confirmLabel={deleteTarget?._count?.tickets ? t('ticketTypes.close') : t('ticketTypes.delete')}
        variant={deleteTarget?._count?.tickets ? 'default' : 'destructive'}
        loading={deleting}
        onConfirm={deleteTarget?._count?.tickets ? () => setDeleteTarget(null) : handleDelete}
      />
    </div>
  );
}
