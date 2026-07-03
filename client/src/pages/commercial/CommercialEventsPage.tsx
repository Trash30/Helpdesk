import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Pencil, Trash2 } from 'lucide-react';
import api from '@/lib/axios';
import { useAuthStore } from '@/stores/authStore';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface CommercialEvent {
  id: string;
  clientName: string;
  startDate: string;
  endDate: string;
  location: string;
  techContactFirstName: string;
  techContactLastName: string;
  techContactEmail: string;
  techContactPhone: string;
  competition: string;
  notes: string;
  createdById: string;
  createdBy: { id: string; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

interface CommercialEventForm {
  clientName: string;
  startDate: string;
  endDate: string;
  location: string;
  techContactFirstName: string;
  techContactLastName: string;
  techContactEmail: string;
  techContactPhone: string;
  competition: string;
  notes: string;
}

const EMPTY_FORM: CommercialEventForm = {
  clientName: '',
  startDate: '',
  endDate: '',
  location: '',
  techContactFirstName: '',
  techContactLastName: '',
  techContactEmail: '',
  techContactPhone: '',
  competition: '',
  notes: '',
};

const REQUIRED_FIELDS: { key: keyof CommercialEventForm; label: string }[] = [
  { key: 'clientName', label: 'Nom du client' },
  { key: 'startDate', label: 'Date de début' },
  { key: 'endDate', label: 'Date de fin' },
  { key: 'location', label: 'Lieu' },
  { key: 'techContactFirstName', label: 'Prénom du contact' },
  { key: 'techContactLastName', label: 'Nom du contact' },
  { key: 'techContactEmail', label: 'Email du contact' },
  { key: 'techContactPhone', label: 'Téléphone du contact' },
];

const TEXTAREA_CLASS =
  'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

function formatRange(startIso: string, endIso: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  };
  const start = new Date(startIso).toLocaleString('fr-FR', opts).replace(',', '');
  const end = new Date(endIso).toLocaleString('fr-FR', opts).replace(',', '');
  return `${start} → ${end}`;
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CommercialEventsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { can } = usePermissions();
  const [form, setForm] = useState<CommercialEventForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof CommercialEventForm, string>>>({});

  const [editingEvent, setEditingEvent] = useState<CommercialEvent | null>(null);
  const [editForm, setEditForm] = useState<CommercialEventForm>(EMPTY_FORM);
  const [editErrors, setEditErrors] = useState<Partial<Record<keyof CommercialEventForm, string>>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['commercial-events'],
    queryFn: async () =>
      ((await api.get('/commercial-events', { params: { horizon: 30 } })).data?.data ?? []) as CommercialEvent[],
  });

  const events: CommercialEvent[] = data ?? [];

  const createMutation = useMutation({
    mutationFn: async (payload: CommercialEventForm) => {
      const body = {
        ...payload,
        startDate: new Date(payload.startDate).toISOString(),
        endDate: new Date(payload.endDate).toISOString(),
      };
      return (await api.post('/commercial-events', body)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commercial-events'] });
      setForm(EMPTY_FORM);
      setErrors({});
      toast.success('Événement enregistré !');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Une erreur est survenue');
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: CommercialEventForm }) => {
      const body = {
        ...payload,
        startDate: new Date(payload.startDate).toISOString(),
        endDate: new Date(payload.endDate).toISOString(),
      };
      return (await api.put(`/commercial-events/${id}`, body)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commercial-events'] });
      setEditingEvent(null);
      setEditErrors({});
      toast.success('Événement mis à jour !');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Une erreur est survenue');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/commercial-events/${id}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commercial-events'] });
      toast.success('Événement supprimé.');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    },
  });

  const setField = (field: keyof CommercialEventForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const setEditField = (field: keyof CommercialEventForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setEditForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Partial<Record<keyof CommercialEventForm, string>> = {};

    for (const { key, label } of REQUIRED_FIELDS) {
      if (!form[key].trim()) {
        newErrors[key] = `${label} est obligatoire`;
      }
    }
    if (form.techContactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.techContactEmail)) {
      newErrors.techContactEmail = 'Email invalide';
    }
    if (form.startDate && form.endDate && new Date(form.endDate) < new Date(form.startDate)) {
      newErrors.endDate = 'La date de fin doit être postérieure à la date de début';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      const firstKey = REQUIRED_FIELDS.find((f) => newErrors[f.key])?.key ?? Object.keys(newErrors)[0];
      const el = document.getElementById(firstKey as string);
      if (el) el.focus();
      return;
    }

    createMutation.mutate(form);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;

    const newErrors: Partial<Record<keyof CommercialEventForm, string>> = {};

    for (const { key, label } of REQUIRED_FIELDS) {
      if (!editForm[key].trim()) {
        newErrors[key] = `${label} est obligatoire`;
      }
    }
    if (editForm.techContactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.techContactEmail)) {
      newErrors.techContactEmail = 'Email invalide';
    }
    if (editForm.startDate && editForm.endDate && new Date(editForm.endDate) < new Date(editForm.startDate)) {
      newErrors.endDate = 'La date de fin doit être postérieure à la date de début';
    }

    setEditErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      const firstKey = REQUIRED_FIELDS.find((f) => newErrors[f.key])?.key ?? Object.keys(newErrors)[0];
      const el = document.getElementById(`edit-${firstKey}`);
      if (el) el.focus();
      return;
    }

    editMutation.mutate({ id: editingEvent.id, payload: editForm });
  };

  const openEdit = (ev: CommercialEvent) => {
    setEditErrors({});
    setEditForm({
      clientName: ev.clientName,
      startDate: toDatetimeLocal(ev.startDate),
      endDate: toDatetimeLocal(ev.endDate),
      location: ev.location,
      techContactFirstName: ev.techContactFirstName,
      techContactLastName: ev.techContactLastName,
      techContactEmail: ev.techContactEmail,
      techContactPhone: ev.techContactPhone,
      competition: ev.competition,
      notes: ev.notes,
    });
    setEditingEvent(ev);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold">Mes événements commerciaux</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nouvel événement</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="clientName">Nom du client <span className="text-destructive">*</span></Label>
                <Input
                  id="clientName"
                  type="text"
                  value={form.clientName}
                  onChange={setField('clientName')}
                  autoComplete="organization"
                  aria-invalid={!!errors.clientName}
                  className={errors.clientName ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {errors.clientName && <p className="text-xs text-destructive">{errors.clientName}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="startDate">Date de début <span className="text-destructive">*</span></Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={form.startDate}
                  onChange={setField('startDate')}
                  aria-invalid={!!errors.startDate}
                  className={errors.startDate ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {errors.startDate && <p className="text-xs text-destructive">{errors.startDate}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate">Date de fin <span className="text-destructive">*</span></Label>
                <Input
                  id="endDate"
                  type="datetime-local"
                  value={form.endDate}
                  onChange={setField('endDate')}
                  aria-invalid={!!errors.endDate}
                  className={errors.endDate ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {errors.endDate && <p className="text-xs text-destructive">{errors.endDate}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="location">Lieu <span className="text-destructive">*</span></Label>
                <Input
                  id="location"
                  type="text"
                  value={form.location}
                  onChange={setField('location')}
                  autoComplete="street-address"
                  aria-invalid={!!errors.location}
                  className={errors.location ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {errors.location && <p className="text-xs text-destructive">{errors.location}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="competition">Compétition <span className="text-xs text-muted-foreground font-normal">(facultatif)</span></Label>
                <Input id="competition" type="text" value={form.competition} onChange={setField('competition')} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="techContactFirstName">Contact technique — Prénom <span className="text-destructive">*</span></Label>
                <Input
                  id="techContactFirstName"
                  type="text"
                  value={form.techContactFirstName}
                  onChange={setField('techContactFirstName')}
                  autoComplete="given-name"
                  aria-invalid={!!errors.techContactFirstName}
                  className={errors.techContactFirstName ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {errors.techContactFirstName && <p className="text-xs text-destructive">{errors.techContactFirstName}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="techContactLastName">Contact technique — Nom <span className="text-destructive">*</span></Label>
                <Input
                  id="techContactLastName"
                  type="text"
                  value={form.techContactLastName}
                  onChange={setField('techContactLastName')}
                  autoComplete="family-name"
                  aria-invalid={!!errors.techContactLastName}
                  className={errors.techContactLastName ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {errors.techContactLastName && <p className="text-xs text-destructive">{errors.techContactLastName}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="techContactEmail">Contact technique — Email <span className="text-destructive">*</span></Label>
                <Input
                  id="techContactEmail"
                  type="email"
                  value={form.techContactEmail}
                  onChange={setField('techContactEmail')}
                  autoComplete="email"
                  inputMode="email"
                  aria-invalid={!!errors.techContactEmail}
                  className={errors.techContactEmail ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {errors.techContactEmail && <p className="text-xs text-destructive">{errors.techContactEmail}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="techContactPhone">Contact technique — Téléphone <span className="text-destructive">*</span></Label>
                <Input
                  id="techContactPhone"
                  type="tel"
                  value={form.techContactPhone}
                  onChange={setField('techContactPhone')}
                  autoComplete="tel"
                  inputMode="tel"
                  aria-invalid={!!errors.techContactPhone}
                  className={errors.techContactPhone ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {errors.techContactPhone && <p className="text-xs text-destructive">{errors.techContactPhone}</p>}
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="notes">Notes <span className="text-xs text-muted-foreground font-normal">(facultatif)</span></Label>
                <textarea
                  id="notes"
                  rows={4}
                  className={TEXTAREA_CLASS}
                  value={form.notes}
                  onChange={setField('notes')}
                />
                {errors.notes && <p className="text-xs text-destructive">{errors.notes}</p>}
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={createMutation.isPending} className="w-full sm:w-auto">
                {createMutation.isPending ? 'Enregistrement…' : "Enregistrer l'événement"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Événements J+30</h2>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        )}

        {!isLoading && events.length === 0 && (
          <Card className="shadow-sm">
            <CardContent className="py-10 text-center text-muted-foreground">
              Aucun événement dans les 30 prochains jours.
            </CardContent>
          </Card>
        )}

        {!isLoading &&
          events.map((ev) => {
            const canEdit = ev.createdById === user?.id || can('admin.access');
            return (
            <Card key={ev.id} className="shadow-sm">
              <CardContent className="py-4 px-4 flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-sm">{ev.clientName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{formatRange(ev.startDate, ev.endDate)}</span>
                    {canEdit && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          aria-label="Éditer l'événement"
                          onClick={() => openEdit(ev)}
                        >
                          <Pencil size={13} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          aria-label="Supprimer l'événement"
                          onClick={() => setDeletingId(ev.id)}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-sm text-foreground/80">
                  {ev.location} · {ev.competition}
                </div>
                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>{ev.techContactFirstName} {ev.techContactLastName}</span>
                  <a href={`mailto:${ev.techContactEmail}`} className="underline hover:text-foreground">{ev.techContactEmail}</a>
                  <a href={`tel:${ev.techContactPhone}`} className="underline hover:text-foreground">{ev.techContactPhone}</a>
                </div>
                {ev.notes && <div className="text-xs text-muted-foreground italic">{ev.notes}</div>}
              </CardContent>
            </Card>
            );
          })}
      </div>

      <Sheet open={!!editingEvent} onOpenChange={(open) => { if (!open) setEditingEvent(null); }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Modifier l'événement</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="edit-clientName">Nom du client <span className="text-destructive">*</span></Label>
                <Input
                  id="edit-clientName"
                  type="text"
                  value={editForm.clientName}
                  onChange={setEditField('clientName')}
                  autoComplete="organization"
                  aria-invalid={!!editErrors.clientName}
                  className={editErrors.clientName ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {editErrors.clientName && <p className="text-xs text-destructive">{editErrors.clientName}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-startDate">Date de début <span className="text-destructive">*</span></Label>
                <Input
                  id="edit-startDate"
                  type="datetime-local"
                  value={editForm.startDate}
                  onChange={setEditField('startDate')}
                  aria-invalid={!!editErrors.startDate}
                  className={editErrors.startDate ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {editErrors.startDate && <p className="text-xs text-destructive">{editErrors.startDate}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-endDate">Date de fin <span className="text-destructive">*</span></Label>
                <Input
                  id="edit-endDate"
                  type="datetime-local"
                  value={editForm.endDate}
                  onChange={setEditField('endDate')}
                  aria-invalid={!!editErrors.endDate}
                  className={editErrors.endDate ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {editErrors.endDate && <p className="text-xs text-destructive">{editErrors.endDate}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-location">Lieu <span className="text-destructive">*</span></Label>
                <Input
                  id="edit-location"
                  type="text"
                  value={editForm.location}
                  onChange={setEditField('location')}
                  autoComplete="street-address"
                  aria-invalid={!!editErrors.location}
                  className={editErrors.location ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {editErrors.location && <p className="text-xs text-destructive">{editErrors.location}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-competition">Compétition <span className="text-xs text-muted-foreground font-normal">(facultatif)</span></Label>
                <Input id="edit-competition" type="text" value={editForm.competition} onChange={setEditField('competition')} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-techContactFirstName">Contact technique — Prénom <span className="text-destructive">*</span></Label>
                <Input
                  id="edit-techContactFirstName"
                  type="text"
                  value={editForm.techContactFirstName}
                  onChange={setEditField('techContactFirstName')}
                  autoComplete="given-name"
                  aria-invalid={!!editErrors.techContactFirstName}
                  className={editErrors.techContactFirstName ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {editErrors.techContactFirstName && <p className="text-xs text-destructive">{editErrors.techContactFirstName}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-techContactLastName">Contact technique — Nom <span className="text-destructive">*</span></Label>
                <Input
                  id="edit-techContactLastName"
                  type="text"
                  value={editForm.techContactLastName}
                  onChange={setEditField('techContactLastName')}
                  autoComplete="family-name"
                  aria-invalid={!!editErrors.techContactLastName}
                  className={editErrors.techContactLastName ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {editErrors.techContactLastName && <p className="text-xs text-destructive">{editErrors.techContactLastName}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-techContactEmail">Contact technique — Email <span className="text-destructive">*</span></Label>
                <Input
                  id="edit-techContactEmail"
                  type="email"
                  value={editForm.techContactEmail}
                  onChange={setEditField('techContactEmail')}
                  autoComplete="email"
                  inputMode="email"
                  aria-invalid={!!editErrors.techContactEmail}
                  className={editErrors.techContactEmail ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {editErrors.techContactEmail && <p className="text-xs text-destructive">{editErrors.techContactEmail}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-techContactPhone">Contact technique — Téléphone <span className="text-destructive">*</span></Label>
                <Input
                  id="edit-techContactPhone"
                  type="tel"
                  value={editForm.techContactPhone}
                  onChange={setEditField('techContactPhone')}
                  autoComplete="tel"
                  inputMode="tel"
                  aria-invalid={!!editErrors.techContactPhone}
                  className={editErrors.techContactPhone ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {editErrors.techContactPhone && <p className="text-xs text-destructive">{editErrors.techContactPhone}</p>}
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="edit-notes">Notes <span className="text-xs text-muted-foreground font-normal">(facultatif)</span></Label>
                <textarea
                  id="edit-notes"
                  rows={4}
                  className={TEXTAREA_CLASS}
                  value={editForm.notes}
                  onChange={setEditField('notes')}
                />
                {editErrors.notes && <p className="text-xs text-destructive">{editErrors.notes}</p>}
              </div>
            </div>

            <SheetFooter>
              <Button type="button" variant="outline" onClick={() => setEditingEvent(null)}>Annuler</Button>
              <Button type="submit" disabled={editMutation.isPending}>
                {editMutation.isPending ? 'Mise à jour…' : 'Mettre à jour'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer l'événement ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Cette action est irréversible.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeletingId(null)}>Annuler</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => { if (deletingId) deleteMutation.mutate(deletingId); setDeletingId(null); }}
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
