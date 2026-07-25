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

const SWATCHES = [
  '#185FA5', '#534AB7', '#0F6E56', '#854F0B', '#5F5E5A',
  '#E24B4A', '#EF9F27', '#639922', '#D4537E', '#0C447C', '#3B6D11', '#A32D2D',
];

interface ClientRole {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  isActive: boolean;
  position: number;
  _count?: { clients: number };
}

function SortableRow({
  role, onEdit, onDelete,
}: { role: ClientRole; onEdit: (r: ClientRole) => void; onDelete: (r: ClientRole) => void }) {
  const { t } = useTranslation('admin');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: role.id });
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
      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: role.color }} />
      <div className="flex-1 min-w-0">
        <span className="font-medium text-sm">{role.name}</span>
        {role.description && (
          <span className="text-xs text-muted-foreground ml-2">{role.description}</span>
        )}
      </div>
      <span className={`text-xs px-1.5 py-0.5 rounded ${
        role.isActive ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
      }`}>
        {role.isActive ? t('clientRoles.active') : t('clientRoles.inactive')}
      </span>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(role)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => onDelete(role)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

const defaultForm = { name: '', description: '', color: '#185FA5', isActive: true };

export function AdminClientRolesPage() {
  const { t } = useTranslation('admin');
  const queryClient = useQueryClient();
  const [items, setItems] = useState<ClientRole[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ClientRole | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [hexInput, setHexInput] = useState('#185FA5');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ClientRole | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data } = useQuery<{ data: ClientRole[] }>({
    queryKey: ['admin-client-roles'],
    queryFn: async () => (await api.get('/admin/client-roles')).data,
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
      await api.patch('/admin/client-roles/reorder',
        newItems.map((item, idx) => ({ id: item.id, position: idx + 1 }))
      );
    } catch {
      toast.error(t('clientRoles.reorderError'));
      queryClient.invalidateQueries({ queryKey: ['admin-client-roles'] });
    }
  };

  const openCreate = () => {
    setEditTarget(null);
    setForm(defaultForm);
    setHexInput('#185FA5');
    setModalOpen(true);
  };

  const openEdit = (role: ClientRole) => {
    setEditTarget(role);
    setForm({
      name: role.name,
      description: role.description ?? '',
      color: role.color,
      isActive: role.isActive,
    });
    setHexInput(role.color);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error(t('clientRoles.nameRequired')); return; }
    setSaving(true);
    try {
      if (editTarget) {
        await api.put(`/admin/client-roles/${editTarget.id}`, form);
        toast.success(t('clientRoles.roleUpdated'));
      } else {
        await api.post('/admin/client-roles', form);
        toast.success(t('clientRoles.roleCreated'));
      }
      queryClient.invalidateQueries({ queryKey: ['admin-client-roles'] });
      setModalOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? t('clientRoles.saveError'));
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/client-roles/${deleteTarget.id}`);
      toast.success(t('clientRoles.roleDeleted'));
      queryClient.invalidateQueries({ queryKey: ['admin-client-roles'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? t('clientRoles.deleteError'));
    } finally { setDeleting(false); setDeleteTarget(null); }
  };

  const selectColor = (c: string) => {
    setForm(f => ({ ...f, color: c }));
    setHexInput(c);
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('clientRoles.title')}</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />{t('clientRoles.newRole')}
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map(role => (
              <SortableRow key={role.id} role={role}
                onEdit={openEdit}
                onDelete={() => setDeleteTarget(role)}
              />
            ))}
            {items.length === 0 && (
              <p className="text-center text-muted-foreground py-12">
                {t('clientRoles.empty')}
              </p>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* Modal création/édition */}
      <Dialog open={modalOpen} onOpenChange={open => { if (!saving) setModalOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? t('clientRoles.editTitle') : t('clientRoles.createTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Preview */}
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <span className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: form.color }} />
              <span className="text-xs font-medium px-2 py-0.5 rounded text-white"
                style={{ backgroundColor: form.color }}>
                {form.name || t('clientRoles.previewPlaceholder')}
              </span>
            </div>

            <div>
              <Label>{t('clientRoles.name')} <span className="text-destructive">*</span></Label>
              <Input value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={t('clientRoles.namePlaceholder')} className="mt-1" />
            </div>

            <div>
              <Label>{t('clientRoles.description')}</Label>
              <Input value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder={t('clientRoles.descriptionPlaceholder')} className="mt-1" />
            </div>

            <div className="flex items-center gap-2">
              <Switch id="crole-active" checked={form.isActive}
                onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
              <Label htmlFor="crole-active">{t('clientRoles.roleActive')}</Label>
            </div>

            {/* Color picker */}
            <div>
              <Label className="mb-2 block">{t('clientRoles.color')}</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {SWATCHES.map(c => (
                  <button key={c} onClick={() => selectColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                      form.color === c ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input type="color" value={form.color}
                  onChange={e => selectColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border" />
                <Input value={hexInput}
                  onChange={e => {
                    setHexInput(e.target.value);
                    if (/^#[0-9a-fA-F]{6}$/.test(e.target.value))
                      setForm(f => ({ ...f, color: e.target.value }));
                  }}
                  placeholder="#185FA5" className="w-28 font-mono text-sm" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              {t('clientRoles.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t('clientRoles.saving') : (editTarget ? t('clientRoles.save') : t('clientRoles.create'))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title={t('clientRoles.deleteTitle')}
        description={
          deleteTarget?._count?.clients
            ? t('clientRoles.deleteInUse', { count: deleteTarget._count.clients })
            : t('clientRoles.deleteConfirm', { name: deleteTarget?.name })
        }
        confirmLabel={deleteTarget?._count?.clients ? t('clientRoles.close') : t('clientRoles.delete')}
        variant={deleteTarget?._count?.clients ? 'default' : 'destructive'}
        loading={deleting}
        onConfirm={deleteTarget?._count?.clients ? () => setDeleteTarget(null) : handleDelete}
      />
    </div>
  );
}
