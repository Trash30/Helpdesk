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
}

export function AdminSettingsPage() {
  const { t } = useTranslation('admin');
  const queryClient = useQueryClient();
  const setBranding = useBrandingStore(s => s.setBranding);

  const { data: settingsRes } = useQuery<{ data: Settings }>({
    queryKey: ['admin-settings'],
    queryFn: async () => (await api.get('/admin/settings')).data,
  });

  const settings = settingsRes?.data ?? {};

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
