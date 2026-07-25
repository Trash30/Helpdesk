import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('admin');
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
    if (file.size > 2 * 1024 * 1024) { toast.error(t('settings.imageTooBig')); return; }
    if (!['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'].includes(file.type)) {
      toast.error(t('settings.formatNotSupported')); return;
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
      toast.success(t('settings.appearanceSaved'));
      setLogoFile(null);
    } catch { toast.error(t('settings.saveError')); }
    finally { setSavingAppearance(false); }
  };

  const handleDeleteLogo = async () => {
    try {
      await api.put('/admin/settings', { logo_url: '' });
      setBranding(null, companyName || 'HelpDesk');
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      setLogoPreview(null); setLogoFile(null);
      toast.success(t('settings.logoDeleted'));
    } catch { toast.error(t('settings.deleteError')); }
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
      toast.success(t('settings.ticketSettingsSaved'));
    } catch { toast.error(t('settings.saveError')); }
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
      toast.success(t('settings.surveySettingsSaved'));
    } catch { toast.error(t('settings.saveError')); }
    finally { setSavingSurveys(false); }
  };

  const currentLogo = logoPreview ?? settings.logo_url ?? null;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">{t('settings.title')}</h1>

      {/* Apparence */}
      <Card>
        <CardHeader><CardTitle className="text-base">{t('settings.appearance')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block">{t('settings.logo')}</Label>
            {currentLogo ? (
              <div className="flex items-start gap-4">
                <img src={currentLogo} alt="Logo" className="max-w-[200px] max-h-[80px] object-contain border rounded p-2" />
                <div className="space-y-2">
                  <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}>
                    {t('settings.change')}
                  </Button>
                  <Button variant="ghost" size="sm" className="block text-destructive hover:text-destructive"
                    onClick={() => setShowDeleteLogo(true)}>
                    {t('settings.deleteLogo')}
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
                <p className="text-sm text-muted-foreground">{t('settings.dragLogoPrefix')}<span className="text-primary underline">{t('settings.dragLogoLink')}</span></p>
                <p className="text-xs text-muted-foreground mt-1">{t('settings.logoFormats')}</p>
              </div>
            )}
            <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); e.target.value = ''; }} />
            {logoFile && <p className="text-xs text-green-700 mt-1">{t('settings.newLogoSelected', { name: logoFile.name })}</p>}
          </div>

          <div>
            <Label htmlFor="company-name">{t('settings.companyName')}</Label>
            <Input id="company-name" value={companyName} onChange={e => setCompanyName(e.target.value)}
              placeholder={t('settings.companyNamePlaceholder')} className="mt-1" />
          </div>
          <div className="flex justify-end">
            <Button onClick={saveAppearance} disabled={savingAppearance}>
              {savingAppearance ? t('settings.saving') : t('settings.save')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tickets */}
      <Card>
        <CardHeader><CardTitle className="text-base">{t('settings.tickets')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="def-priority">{t('settings.defaultPriority')}</Label>
            <select id="def-priority" value={defaultPriority} onChange={e => setDefaultPriority(e.target.value)}
              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none">
              <option value="LOW">{t('settings.priorityLow')}</option>
              <option value="MEDIUM">{t('settings.priorityMedium')}</option>
              <option value="HIGH">{t('settings.priorityHigh')}</option>
              <option value="CRITICAL">{t('settings.priorityCritical')}</option>
            </select>
          </div>
          <div>
            <Label htmlFor="def-agent">{t('settings.defaultAgent')}</Label>
            <select id="def-agent" value={defaultAssignedTo} onChange={e => setDefaultAssignedTo(e.target.value)}
              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none">
              <option value="">{t('settings.unassigned')}</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="auto-close">{t('settings.autoClose')}</Label>
            <Input id="auto-close" type="number" min="0" value={autoCloseDays}
              onChange={e => setAutoCloseDays(e.target.value)} className="mt-1" />
            <p className="text-xs text-muted-foreground mt-1">
              {t('settings.autoCloseHelp')}
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveTickets} disabled={savingTickets}>
              {savingTickets ? t('settings.saving') : t('settings.save')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Enquêtes */}
      <Card>
        <CardHeader><CardTitle className="text-base">{t('settings.surveys')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="survey-delay">{t('settings.surveyDelay')}</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input id="survey-delay" type="number" min="1" value={surveyDelay}
                onChange={e => setSurveyDelay(e.target.value)} className="w-28" />
              <span className="text-sm text-muted-foreground">{t('settings.hours')}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('settings.surveyDelayHelp')}
            </p>
          </div>
          <div>
            <Label htmlFor="survey-cooldown">{t('settings.surveyCooldown')}</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input id="survey-cooldown" type="number" min="1" value={surveyCooldown}
                onChange={e => setSurveyCooldown(e.target.value)} className="w-28" />
              <span className="text-sm text-muted-foreground">{t('settings.days')}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('settings.surveyCooldownHelp')}
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveSurveys} disabled={savingSurveys}>
              {savingSurveys ? t('settings.saving') : t('settings.save')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showDeleteLogo}
        onOpenChange={open => !open && setShowDeleteLogo(false)}
        title={t('settings.deleteLogoTitle')}
        description={t('settings.deleteLogoDesc')}
        confirmLabel={t('settings.delete')}
        variant="destructive"
        onConfirm={handleDeleteLogo}
      />
    </div>
  );
}
