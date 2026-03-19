import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/axios';
import { useBrandingStore } from '@/stores/brandingStore';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Settings {
  logo_url?: string | null;
  company_name?: string;
  default_priority?: string;
  default_assigned_to?: string;
  auto_close_days?: string;
  survey_delay_hours?: string;
  survey_cooldown_days?: string;
}

interface Agent { id: string; firstName: string; lastName: string }

export function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const setBranding = useBrandingStore(s => s.setBranding);

  const { data: settingsRes } = useQuery<{ data: Settings }>({
    queryKey: ['admin-settings'],
    queryFn: async () => (await api.get('/admin/settings')).data,
  });

  const { data: agentsRes } = useQuery<{ data: Agent[] }>({
    queryKey: ['agents'],
    queryFn: async () => (await api.get('/admin/users')).data,
  });

  const settings = settingsRes?.data ?? {};
  const agents = agentsRes?.data ?? [];

  // ── Apparence ────────────────────────────────────────────────────────────────
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [showDeleteLogo, setShowDeleteLogo] = useState(false);
  const [savingAppearance, setSavingAppearance] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings.company_name !== undefined) setCompanyName(settings.company_name ?? '');
  }, [settings.company_name]);

  const handleLogoFile = (file: File) => {
    if (file.size > 2 * 1024 * 1024) { toast.error('Image trop grande (max 2 Mo)'); return; }
    if (!['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'].includes(file.type)) {
      toast.error('Format non supporté (PNG, JPG, SVG, WebP)'); return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const saveAppearance = async () => {
    setSavingAppearance(true);
    try {
      let newLogoUrl = settings.logo_url ?? null;
      if (logoFile) {
        const fd = new FormData();
        fd.append('logo', logoFile);
        const res = await api.post('/admin/settings/logo', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        newLogoUrl = res.data.data.logo_url;
      }
      await api.put('/admin/settings', { company_name: companyName });
      setBranding(newLogoUrl, companyName || 'HelpDesk');
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      toast.success('Apparence enregistrée');
      setLogoFile(null);
    } catch { toast.error('Erreur lors de la sauvegarde'); }
    finally { setSavingAppearance(false); }
  };

  const handleDeleteLogo = async () => {
    try {
      await api.put('/admin/settings', { logo_url: '' });
      setBranding(null, companyName || 'HelpDesk');
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      setLogoPreview(null); setLogoFile(null);
      toast.success('Logo supprimé');
    } catch { toast.error('Erreur lors de la suppression'); }
    finally { setShowDeleteLogo(false); }
  };

  // ── Tickets ──────────────────────────────────────────────────────────────────
  const [defaultPriority, setDefaultPriority] = useState('MEDIUM');
  const [defaultAssignedTo, setDefaultAssignedTo] = useState('');
  const [autoCloseDays, setAutoCloseDays] = useState('0');
  const [savingTickets, setSavingTickets] = useState(false);

  useEffect(() => {
    if (settings.default_priority) setDefaultPriority(settings.default_priority);
    if (settings.default_assigned_to !== undefined) setDefaultAssignedTo(settings.default_assigned_to ?? '');
    if (settings.auto_close_days !== undefined) setAutoCloseDays(settings.auto_close_days ?? '0');
  }, [settings.default_priority, settings.default_assigned_to, settings.auto_close_days]);

  const saveTickets = async () => {
    setSavingTickets(true);
    try {
      await api.put('/admin/settings', {
        default_priority: defaultPriority,
        default_assigned_to: defaultAssignedTo,
        auto_close_days: autoCloseDays,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      toast.success('Paramètres tickets enregistrés');
    } catch { toast.error('Erreur lors de la sauvegarde'); }
    finally { setSavingTickets(false); }
  };

  // ── Enquêtes ─────────────────────────────────────────────────────────────────
  const [surveyDelay, setSurveyDelay] = useState('48');
  const [surveyCooldown, setSurveyCooldown] = useState('10');
  const [savingSurveys, setSavingSurveys] = useState(false);

  useEffect(() => {
    if (settings.survey_delay_hours) setSurveyDelay(settings.survey_delay_hours);
    if (settings.survey_cooldown_days) setSurveyCooldown(settings.survey_cooldown_days);
  }, [settings.survey_delay_hours, settings.survey_cooldown_days]);

  const saveSurveys = async () => {
    setSavingSurveys(true);
    try {
      await api.put('/admin/settings', {
        survey_delay_hours: surveyDelay,
        survey_cooldown_days: surveyCooldown,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      toast.success('Paramètres enquêtes enregistrés');
    } catch { toast.error('Erreur lors de la sauvegarde'); }
    finally { setSavingSurveys(false); }
  };

  const currentLogo = logoPreview ?? settings.logo_url ?? null;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Paramètres</h1>

      {/* Apparence */}
      <Card>
        <CardHeader><CardTitle className="text-base">Apparence</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block">Logo</Label>
            {currentLogo ? (
              <div className="flex items-start gap-4">
                <img src={currentLogo} alt="Logo" className="max-w-[200px] max-h-[80px] object-contain border rounded p-2" />
                <div className="space-y-2">
                  <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}>
                    Changer
                  </Button>
                  <Button variant="ghost" size="sm" className="block text-destructive hover:text-destructive"
                    onClick={() => setShowDeleteLogo(true)}>
                    Supprimer le logo
                  </Button>
                </div>
              </div>
            ) : (
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleLogoFile(f); }}
                onClick={() => logoInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                  ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-muted-foreground/50'}`}
              >
                <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Glissez votre logo ici ou <span className="text-primary underline">cliquez</span></p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG, WebP — max 2 Mo</p>
              </div>
            )}
            <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); e.target.value = ''; }} />
            {logoFile && <p className="text-xs text-green-700 mt-1">Nouveau logo sélectionné : {logoFile.name}</p>}
          </div>

          <div>
            <Label htmlFor="company-name">Nom de l'entreprise</Label>
            <Input id="company-name" value={companyName} onChange={e => setCompanyName(e.target.value)}
              placeholder="Mon Helpdesk" className="mt-1" />
          </div>
          <div className="flex justify-end">
            <Button onClick={saveAppearance} disabled={savingAppearance}>
              {savingAppearance ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tickets */}
      <Card>
        <CardHeader><CardTitle className="text-base">Tickets</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="def-priority">Priorité par défaut</Label>
            <select id="def-priority" value={defaultPriority} onChange={e => setDefaultPriority(e.target.value)}
              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none">
              <option value="LOW">Basse</option>
              <option value="MEDIUM">Moyenne</option>
              <option value="HIGH">Haute</option>
              <option value="CRITICAL">Critique</option>
            </select>
          </div>
          <div>
            <Label htmlFor="def-agent">Agent assigné par défaut</Label>
            <select id="def-agent" value={defaultAssignedTo} onChange={e => setDefaultAssignedTo(e.target.value)}
              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none">
              <option value="">Non assigné</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="auto-close">Fermeture automatique après (jours)</Label>
            <Input id="auto-close" type="number" min="0" value={autoCloseDays}
              onChange={e => setAutoCloseDays(e.target.value)} className="mt-1" />
            <p className="text-xs text-muted-foreground mt-1">
              Les tickets résolus seront automatiquement fermés après ce nombre de jours (0 = désactivé)
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveTickets} disabled={savingTickets}>
              {savingTickets ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Enquêtes */}
      <Card>
        <CardHeader><CardTitle className="text-base">Enquêtes de satisfaction</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="survey-delay">Délai avant envoi</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input id="survey-delay" type="number" min="1" value={surveyDelay}
                onChange={e => setSurveyDelay(e.target.value)} className="w-28" />
              <span className="text-sm text-muted-foreground">heures</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Délai après la résolution d'un ticket avant d'envoyer l'enquête
            </p>
          </div>
          <div>
            <Label htmlFor="survey-cooldown">Cooldown entre deux enquêtes</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input id="survey-cooldown" type="number" min="1" value={surveyCooldown}
                onChange={e => setSurveyCooldown(e.target.value)} className="w-28" />
              <span className="text-sm text-muted-foreground">jours</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Un même client ne recevra pas deux enquêtes dans cet intervalle
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveSurveys} disabled={savingSurveys}>
              {savingSurveys ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showDeleteLogo}
        onOpenChange={open => !open && setShowDeleteLogo(false)}
        title="Supprimer le logo"
        description="Le logo sera supprimé définitivement."
        confirmLabel="Supprimer"
        variant="destructive"
        onConfirm={handleDeleteLogo}
      />
    </div>
  );
}
