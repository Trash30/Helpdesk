import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/axios';
import { useClientPanel } from '@/contexts/ClientPanelContext';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClientRole {
  id: string;
  name: string;
  color: string;
}

interface ClientFormData {
  firstName: string;
  lastName: string;
  company: string;
  phone: string;
  email: string;
  roleId: string;
  isSurveyable: boolean;
  notes: string;
}

const EMPTY_FORM: ClientFormData = {
  firstName: '',
  lastName: '',
  company: '',
  phone: '',
  email: '',
  roleId: '',
  isSurveyable: true,
  notes: '',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ClientSlideOver() {
  const { isOpen, clientId, closeClientPanel } = useClientPanel();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<ClientFormData>(EMPTY_FORM);
  const [originalForm, setOriginalForm] = useState<ClientFormData>(EMPTY_FORM);
  const [showUnsaved, setShowUnsaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditMode = !!clientId;

  const { data: clientData, isLoading: loadingClient } = useQuery({
    queryKey: ['client-slide', clientId],
    queryFn: async () => (await api.get(`/clients/${clientId}`)).data,
    enabled: isOpen && !!clientId,
  });

  const { data: clientRoles } = useQuery<ClientRole[]>({
    queryKey: ['client-roles-public'],
    queryFn: async () => (await api.get('/client-roles')).data,
    enabled: isOpen,
  });

  // Populate form when client data loads (edit mode)
  useEffect(() => {
    if (clientData) {
      const f: ClientFormData = {
        firstName: clientData.firstName ?? '',
        lastName: clientData.lastName ?? '',
        company: clientData.company ?? '',
        phone: clientData.phone ?? '',
        email: clientData.email ?? '',
        roleId: clientData.roleId ?? '',
        isSurveyable: clientData.isSurveyable ?? true,
        notes: clientData.notes ?? '',
      };
      setForm(f);
      setOriginalForm(f);
      setErrors({});
    }
  }, [clientData]);

  // Reset when opening in create mode
  useEffect(() => {
    if (isOpen && !clientId) {
      setForm(EMPTY_FORM);
      setOriginalForm(EMPTY_FORM);
      setErrors({});
    }
  }, [isOpen, clientId]);

  const isDirty = JSON.stringify(form) !== JSON.stringify(originalForm);

  const createMutation = useMutation({
    mutationFn: (data: ClientFormData) => api.post('/clients', data),
    onSuccess: () => {
      toast.success('Client créé');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      closeClientPanel();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? 'Erreur lors de la création');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: ClientFormData) => api.put(`/clients/${clientId}`, data),
    onSuccess: () => {
      toast.success('Client mis à jour');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client-detail', clientId] });
      queryClient.invalidateQueries({ queryKey: ['client-slide', clientId] });
      closeClientPanel();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? 'Erreur lors de la mise à jour');
    },
  });

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = 'Prénom requis';
    if (!form.lastName.trim()) e.lastName = 'Nom requis';
    if (!form.phone.trim() && !form.email.trim()) {
      e.contact = 'Au moins un contact requis (téléphone ou email)';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (isEditMode) {
      updateMutation.mutate(form);
    } else {
      createMutation.mutate(form);
    }
  };

  const handleClose = () => {
    if (isDirty) {
      setShowUnsaved(true);
    } else {
      closeClientPanel();
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const selectedRole = clientRoles?.find(r => r.id === form.roleId);

  return (
    <TooltipProvider>
      <Sheet open={isOpen} onOpenChange={open => !open && handleClose()}>
        <SheetContent className="w-full sm:max-w-[480px] flex flex-col overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{isEditMode ? 'Modifier le client' : 'Nouveau client'}</SheetTitle>
          </SheetHeader>

          {loadingClient && isEditMode ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Chargement...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 gap-4">

              {/* firstName + lastName */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sf-firstName">Prénom *</Label>
                  <Input
                    id="sf-firstName"
                    value={form.firstName}
                    onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                    placeholder="Prénom"
                  />
                  {errors.firstName && (
                    <p className="text-xs text-destructive">{errors.firstName}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sf-lastName">Nom *</Label>
                  <Input
                    id="sf-lastName"
                    value={form.lastName}
                    onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                    placeholder="Nom"
                  />
                  {errors.lastName && (
                    <p className="text-xs text-destructive">{errors.lastName}</p>
                  )}
                </div>
              </div>

              {/* Company */}
              <div className="space-y-1.5">
                <Label htmlFor="sf-company">Société</Label>
                <Input
                  id="sf-company"
                  value={form.company}
                  onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                  placeholder="Société"
                />
              </div>

              {/* phone + email */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sf-phone">Téléphone</Label>
                  <Input
                    id="sf-phone"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="Téléphone"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sf-email">Email</Label>
                  <Input
                    id="sf-email"
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="Email"
                  />
                </div>
              </div>
              {errors.contact && (
                <p className="text-xs text-destructive -mt-2">{errors.contact}</p>
              )}

              {/* Client role */}
              <div className="space-y-1.5">
                <Label htmlFor="sf-role">Rôle client</Label>
                <div className="flex items-center gap-2">
                  <select
                    id="sf-role"
                    value={form.roleId}
                    onChange={e => setForm(f => ({ ...f, roleId: e.target.value }))}
                    className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Aucun rôle</option>
                    {clientRoles?.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  {selectedRole && (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white shrink-0"
                      style={{ backgroundColor: selectedRole.color }}
                    >
                      {selectedRole.name}
                    </span>
                  )}
                </div>
              </div>

              {/* isSurveyable */}
              <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20">
                <Switch
                  id="sf-surveyable"
                  checked={form.isSurveyable}
                  onCheckedChange={v => setForm(f => ({ ...f, isSurveyable: v }))}
                />
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="sf-surveyable" className="cursor-pointer font-medium">
                      Enquêtes de satisfaction
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-default text-muted-foreground">
                          <Info className="h-3.5 w-3.5" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[240px] text-xs">
                        Si activé, une enquête NPS/CSAT sera automatiquement envoyée après la résolution d'un ticket, selon les délais configurés dans les paramètres.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {form.isSurveyable
                      ? 'Les enquêtes seront envoyées automatiquement.'
                      : 'Si désactivé, aucune enquête NPS/CSAT ne sera envoyée.'}
                  </p>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="sf-notes">Notes</Label>
                <textarea
                  id="sf-notes"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Notes internes..."
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                />
              </div>

              <div className="flex-1" />

              {/* Footer */}
              <SheetFooter className="gap-2 pt-4 border-t mt-auto">
                <Button type="button" variant="outline" onClick={handleClose} disabled={isSaving}>
                  Annuler
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>

      {/* Unsaved changes confirm */}
      <ConfirmDialog
        open={showUnsaved}
        onOpenChange={open => !open && setShowUnsaved(false)}
        title="Modifications non enregistrées"
        description="Vous avez des modifications non enregistrées. Voulez-vous vraiment fermer ?"
        confirmLabel="Fermer sans enregistrer"
        variant="destructive"
        onConfirm={() => {
          setShowUnsaved(false);
          closeClientPanel();
        }}
      />
    </TooltipProvider>
  );
}
