import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Plus, Pencil, Trash2, Server, ExternalLink } from 'lucide-react';
import api from '@/lib/axios';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

type Division = 'TOP14' | 'PRO_D2';

interface BmcCard {
  id: string;
  name: string;
  ip: string;
  division: Division;
  createdBy: { id: string; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

interface BmcCardForm {
  name: string;
  ip: string;
  division: Division;
}

const DIVISIONS: { value: Division; label: string; color: string }[] = [
  { value: 'TOP14', label: 'TOP 14', color: '#185FA5' },
  { value: 'PRO_D2', label: 'Pro D2', color: '#534AB7' },
];

const DIVISION_META: Record<Division, { label: string; color: string }> = {
  TOP14: { label: 'TOP 14', color: '#185FA5' },
  PRO_D2: { label: 'Pro D2', color: '#534AB7' },
};

const EMPTY_FORM: BmcCardForm = { name: '', ip: '', division: 'TOP14' };

// Cartes BMC = interfaces de gestion physique (iDRAC/iLO) de serveurs internes :
// on n'accepte que des IP privées RFC1918, jamais une adresse publique (même règle
// appliquée côté backend dans bmcCards.ts).
const PRIVATE_IPV4_SHAPE =
  /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})$/;

function isValidIpv4(value: string): boolean {
  if (!PRIVATE_IPV4_SHAPE.test(value)) return false;
  return value.split('.').every((octet) => {
    const n = Number(octet);
    return Number.isInteger(n) && n >= 0 && n <= 255;
  });
}

function openBmc(ip: string) {
  window.open(`https://${ip}`, '_blank', 'noopener');
}

interface BmcCardTileProps {
  card: BmcCard;
  canManage: boolean;
  canDelete: boolean;
  onEdit: (card: BmcCard) => void;
  onDelete: (card: BmcCard) => void;
}

function BmcCardTile({ card, canManage, canDelete, onEdit, onDelete }: BmcCardTileProps) {
  const meta = DIVISION_META[card.division];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openBmc(card.ip);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openBmc(card.ip)}
      onKeyDown={handleKeyDown}
      title={`Ouvrir https://${card.ip}`}
      className="group relative flex flex-col gap-2 p-4 bg-card border rounded-lg cursor-pointer transition-all hover:shadow-md hover:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded text-white"
          style={{ backgroundColor: meta.color }}
        >
          {meta.label}
        </span>
        {(canManage || canDelete) && (
          <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
            {canManage && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label={`Modifier ${card.name}`}
                onClick={(e) => { e.stopPropagation(); onEdit(card); }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                aria-label={`Supprimer ${card.name}`}
                onClick={(e) => { e.stopPropagation(); onDelete(card); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="min-w-0">
        <p className="font-medium text-sm truncate" title={card.name}>{card.name}</p>
        <p className="font-mono text-xs text-muted-foreground truncate flex items-center gap-1">
          {card.ip}
          <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </p>
        <p className="text-[11px] text-muted-foreground/70 truncate">
          Ajoutée par {card.createdBy.firstName} {card.createdBy.lastName}
        </p>
      </div>
    </div>
  );
}

export function BmcCardsPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const canManage = can('bmc.manage');
  const canDelete = can('bmc.delete');

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<BmcCard | null>(null);
  const [form, setForm] = useState<BmcCardForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof BmcCardForm, string>>>({});
  const [deleteTarget, setDeleteTarget] = useState<BmcCard | null>(null);

  const { data, isLoading } = useQuery<{ data: BmcCard[] }>({
    queryKey: ['bmc-cards'],
    queryFn: async () => (await api.get('/bmc-cards')).data,
  });

  const cards = useMemo(() => data?.data ?? [], [data]);

  const byDivision = useMemo(() => ({
    TOP14: cards.filter((c) => c.division === 'TOP14'),
    PRO_D2: cards.filter((c) => c.division === 'PRO_D2'),
  }), [cards]);

  const closeModal = () => {
    setModalOpen(false);
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setErrors({});
  };

  const saveMutation = useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: BmcCardForm }) =>
      id
        ? (await api.put(`/bmc-cards/${id}`, payload)).data
        : (await api.post('/bmc-cards', payload)).data,
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bmc-cards'] });
      toast.success(variables.id ? 'Carte BMC modifiée.' : 'Carte BMC ajoutée.');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Une erreur est survenue.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/bmc-cards/${id}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bmc-cards'] });
      toast.success('Carte BMC supprimée.');
      setDeleteTarget(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Une erreur est survenue.');
    },
  });

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (card: BmcCard) => {
    setEditTarget(card);
    setForm({ name: card.name, ip: card.ip, division: card.division });
    setErrors({});
    setModalOpen(true);
  };

  const handleSave = () => {
    const nextErrors: Partial<Record<keyof BmcCardForm, string>> = {};
    const name = form.name.trim();
    const ip = form.ip.trim();

    if (!name) nextErrors.name = 'Le nom du serveur est obligatoire.';
    if (!ip) nextErrors.ip = "L'adresse IP est obligatoire.";
    else if (!isValidIpv4(ip)) nextErrors.ip = 'Adresse IPv4 privée invalide (10.x, 172.16-31.x ou 192.168.x attendu).';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    saveMutation.mutate({
      id: editTarget?.id,
      payload: { name, ip, division: form.division },
    });
  };

  const saving = saveMutation.isPending;

  const renderSection = (division: Division) => {
    const meta = DIVISION_META[division];
    const items = byDivision[division];
    return (
      <section key={division} className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
          <h2 className="text-lg font-semibold">{meta.label}</h2>
          <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
            {items.length}
          </span>
        </div>

        {isLoading ? (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}
          >
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[104px] rounded-lg" />)}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-6 text-center">
            Aucune carte BMC en {meta.label} pour l'instant.
          </p>
        ) : (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}
          >
            {items.map((card) => (
              <BmcCardTile
                key={card.id}
                card={card}
                canManage={canManage}
                canDelete={canDelete}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Server className="h-6 w-6 text-primary" />
            Cartes BMC — Serveurs LNR
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Répertoire des adresses de gestion (BMC / iDRAC / iLO) des serveurs LNR.
            Cliquez sur une carte pour ouvrir son interface d'administration.
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate} className="sm:shrink-0">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une carte
          </Button>
        )}
      </div>

      {renderSection('TOP14')}
      {renderSection('PRO_D2')}

      {/* Modale création / édition */}
      <Dialog open={modalOpen} onOpenChange={(open) => { if (!saving && !open) closeModal(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? 'Modifier la carte BMC' : 'Ajouter une carte BMC'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="bmc-name">
                Nom du serveur <span className="text-destructive">*</span>
              </Label>
              <Input
                id="bmc-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex. SRV-STADE-01"
                aria-invalid={!!errors.name}
                className={errors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bmc-ip">
                Adresse IP <span className="text-destructive">*</span>
              </Label>
              <Input
                id="bmc-ip"
                type="text"
                value={form.ip}
                onChange={(e) => setForm((f) => ({ ...f, ip: e.target.value }))}
                placeholder="192.168.10.42"
                aria-invalid={!!errors.ip}
                className={`font-mono ${errors.ip ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              />
              {errors.ip
                ? <p className="text-xs text-destructive">{errors.ip}</p>
                : <p className="text-xs text-muted-foreground">Ouverte en https:// dans un nouvel onglet au clic sur la carte.</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Division</Label>
              <div className="grid grid-cols-2 gap-2">
                {DIVISIONS.map((d) => {
                  const active = form.division === d.value;
                  return (
                    <button
                      key={d.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setForm((f) => ({ ...f, division: d.value }))}
                      className={`px-3 py-2 rounded-md border-2 text-sm font-medium transition-colors ${
                        active ? '' : 'border-transparent bg-muted text-muted-foreground hover:bg-muted/70'
                      }`}
                      style={active
                        ? { borderColor: d.color, backgroundColor: `${d.color}1A`, color: d.color }
                        : undefined}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeModal} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Supprimer la carte BMC"
        description={
          deleteTarget
            ? `La carte « ${deleteTarget.name} » (${deleteTarget.ip}) sera définitivement supprimée.`
            : undefined
        }
        confirmLabel="Supprimer"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
