import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import api from '@/lib/axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

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

export function CommercialEventsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CommercialEventForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof CommercialEventForm, string>>>({});

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

  const setField = (field: keyof CommercialEventForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

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
          events.map((ev) => (
            <Card key={ev.id} className="shadow-sm">
              <CardContent className="py-4 px-4 flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-sm">{ev.clientName}</span>
                  <span className="text-xs text-muted-foreground">{formatRange(ev.startDate, ev.endDate)}</span>
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
          ))}
      </div>
    </div>
  );
}
