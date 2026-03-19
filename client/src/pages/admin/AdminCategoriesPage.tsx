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
import {
  GripVertical, Plus, Pencil, Trash2,
  Monitor, Code, Wifi, Lock, Printer, Mail, Phone, Database, Server, HardDrive,
  Cpu, Globe, Shield, AlertTriangle, Settings, Wrench, Package, Users, FileText,
  Cloud, Smartphone, Headphones, Camera, Mic, Battery, Zap, Link, Key, Bug, LifeBuoy,
} from 'lucide-react';
import api from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Monitor, Code, Wifi, Lock, Printer, Mail, Phone, Database, Server, HardDrive,
  Cpu, Globe, Shield, AlertTriangle, Settings, Wrench, Package, Users, FileText,
  Cloud, Smartphone, Headphones, Camera, Mic, Battery, Zap, Link, Key, Bug, LifeBuoy,
};
const ICON_NAMES = Object.keys(ICON_MAP);

const SWATCHES = [
  '#185FA5', '#534AB7', '#0F6E56', '#854F0B', '#5F5E5A',
  '#E24B4A', '#EF9F27', '#639922', '#D4537E', '#0C447C', '#3B6D11', '#A32D2D',
];

interface Category {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string;
  description?: string | null;
  isActive: boolean;
  position: number;
  _count?: { tickets: number };
}

function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return <Icon className={className} />;
}

function SortableRow({
  cat, onEdit, onDelete,
}: { cat: Category; onEdit: (c: Category) => void; onDelete: (c: Category) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: cat.id });
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
      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
      <CategoryIcon name={cat.icon} className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="font-medium text-sm">{cat.name}</span>
        {cat.description && (
          <span className="text-xs text-muted-foreground ml-2">{cat.description}</span>
        )}
      </div>
      <span className={`text-xs px-1.5 py-0.5 rounded ${
        cat.isActive ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
      }`}>
        {cat.isActive ? 'Actif' : 'Inactif'}
      </span>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(cat)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => onDelete(cat)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

const defaultForm = { name: '', description: '', color: '#185FA5', icon: 'Monitor', isActive: true };

export function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<Category[]>([]);
  const [iconSearch, setIconSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [hexInput, setHexInput] = useState('#185FA5');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data } = useQuery<{ data: Category[] }>({
    queryKey: ['admin-categories'],
    queryFn: async () => (await api.get('/admin/categories')).data,
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
      await api.patch('/admin/categories/reorder',
        newItems.map((item, idx) => ({ id: item.id, position: idx + 1 }))
      );
    } catch {
      toast.error('Erreur lors du réordonnancement');
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
    }
  };

  const openCreate = () => {
    setEditTarget(null);
    setForm(defaultForm);
    setHexInput('#185FA5');
    setIconSearch('');
    setModalOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditTarget(cat);
    setForm({
      name: cat.name,
      description: cat.description ?? '',
      color: cat.color,
      icon: cat.icon,
      isActive: cat.isActive,
    });
    setHexInput(cat.color);
    setIconSearch('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Le nom est requis'); return; }
    setSaving(true);
    try {
      if (editTarget) {
        await api.put(`/admin/categories/${editTarget.id}`, form);
        toast.success('Catégorie mise à jour');
      } else {
        await api.post('/admin/categories', form);
        toast.success('Catégorie créée');
      }
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      setModalOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Erreur lors de la sauvegarde');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/categories/${deleteTarget.id}`);
      toast.success('Catégorie supprimée');
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Erreur lors de la suppression');
    } finally { setDeleting(false); setDeleteTarget(null); }
  };

  const selectColor = (c: string) => {
    setForm(f => ({ ...f, color: c }));
    setHexInput(c);
  };

  const filteredIcons = iconSearch
    ? ICON_NAMES.filter(n => n.toLowerCase().includes(iconSearch.toLowerCase()))
    : ICON_NAMES;

  const PreviewIcon = ICON_MAP[form.icon];

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Catégories</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />Nouvelle catégorie
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map(cat => (
              <SortableRow key={cat.id} cat={cat}
                onEdit={openEdit}
                onDelete={() => setDeleteTarget(cat)}
              />
            ))}
            {items.length === 0 && (
              <p className="text-center text-muted-foreground py-12">
                Aucune catégorie. Créez-en une pour commencer.
              </p>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* Modal création/édition */}
      <Dialog open={modalOpen} onOpenChange={open => { if (!saving) setModalOpen(open); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Preview badge */}
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <span className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: form.color }} />
              {PreviewIcon && <PreviewIcon className="h-4 w-4 flex-shrink-0"
                style={{ color: form.color } as React.CSSProperties} />}
              <span className="text-sm font-medium">
                {form.name || 'Aperçu de la catégorie'}
              </span>
            </div>

            <div>
              <Label>Nom <span className="text-destructive">*</span></Label>
              <Input value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Matériel" className="mt-1" />
            </div>

            <div>
              <Label>Description</Label>
              <Input value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Description optionnelle" className="mt-1" />
            </div>

            <div className="flex items-center gap-2">
              <Switch id="cat-active" checked={form.isActive}
                onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
              <Label htmlFor="cat-active">Catégorie active</Label>
            </div>

            {/* Color picker */}
            <div>
              <Label className="mb-2 block">Couleur</Label>
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

            {/* Icon picker */}
            <div>
              <Label className="mb-2 block">Icône</Label>
              <Input value={iconSearch}
                onChange={e => setIconSearch(e.target.value)}
                placeholder="Rechercher une icône..." className="mb-2" />
              <div className="grid grid-cols-6 gap-1 max-h-40 overflow-y-auto border rounded p-2">
                {filteredIcons.map(name => {
                  const Icon = ICON_MAP[name];
                  return (
                    <button key={name} title={name}
                      onClick={() => setForm(f => ({ ...f, icon: name }))}
                      className={`p-2 rounded flex items-center justify-center transition-colors ${
                        form.icon === name
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}>
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
                {filteredIcons.length === 0 && (
                  <p className="col-span-6 text-xs text-center text-muted-foreground py-2">
                    Aucune icône trouvée
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Sélectionné : {form.icon}</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Enregistrement...' : (editTarget ? 'Enregistrer' : 'Créer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title="Supprimer la catégorie"
        description={
          deleteTarget?._count?.tickets
            ? `Cette catégorie est utilisée par ${deleteTarget._count.tickets} ticket(s) et ne peut pas être supprimée.`
            : `Supprimer la catégorie "${deleteTarget?.name}" ? Cette action est irréversible.`
        }
        confirmLabel={deleteTarget?._count?.tickets ? 'Fermer' : 'Supprimer'}
        variant={deleteTarget?._count?.tickets ? 'default' : 'destructive'}
        loading={deleting}
        onConfirm={deleteTarget?._count?.tickets ? () => setDeleteTarget(null) : handleDelete}
      />
    </div>
  );
}
