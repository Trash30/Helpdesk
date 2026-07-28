import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { usePermissions } from '@/hooks/usePermissions';
import { getInitials } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { PasswordStrength } from '@/components/ui/PasswordStrength';
import api from '@/lib/axios';

const COMPETITIONS = [
  { key: 'TOP14',          label: 'TOP 14' },
  { key: 'PRO_D2',         label: 'PRO D2' },
  { key: 'LNH',            label: 'Liqui Moly Starligue' },
  { key: 'EPCR',           label: 'EPCR Champions Cup' },
  { key: 'EPCR_CHALLENGE', label: 'EPCR Challenge Cup' },
  { key: 'ELMS',           label: 'ELMS' },
  { key: 'ESTONIE',        label: 'Premium Liiga (Estonie)' },
  { key: 'SKI_CROSS',      label: 'Ski Cross' },
] as const;

export function ProfilePage() {
  const { t } = useTranslation('common');
  const { user, logout, updateSportCompetitions } = useAuthStore();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const isAdmin = can('admin.access');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const [selectedComps, setSelectedComps] = useState<string[]>(user?.sportCompetitions ?? []);
  const [compLoading, setCompLoading] = useState(false);

  const handleSaveCompetitions = async () => {
    setCompLoading(true);
    try {
      await api.patch('/auth/sport-competitions', { sportCompetitions: selectedComps });
      updateSportCompetitions(selectedComps);
      toast.success(t('profile.competitionsUpdated'));
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? t('profile.competitionsError'));
    } finally {
      setCompLoading(false);
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t('profile.passwordMismatch'));
      return;
    }
    setPwLoading(true);
    try {
      await api.patch('/auth/change-password', { currentPassword, newPassword, confirmPassword });
      toast.success(t('profile.passwordUpdated'));
      try { await api.post('/auth/logout'); } catch {}
      logout();
      navigate('/login', { replace: true });
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? t('profile.changeError'));
    } finally {
      setPwLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">{t('profile.title')}</h1>

      {/* User info card */}
      <div className="bg-card rounded-lg border p-6 flex items-center gap-5">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary text-primary-foreground text-2xl font-bold shrink-0">
          {getInitials(user.firstName, user.lastName)}
        </div>
        <div className="flex-1">
          <p className="text-xl font-semibold">{user.firstName} {user.lastName}</p>
          <p className="text-muted-foreground text-sm">{user.email}</p>
          <span className="inline-flex items-center mt-1 text-xs px-2 py-0.5 rounded-full border font-medium">
            {user.role.name}
          </span>
        </div>
      </div>

      <Separator />

      {/* Sport competitions section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">{t('profile.competitionsTitle')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('profile.competitionsDesc')}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {COMPETITIONS.map(({ key, label }) => (
            <label
              key={key}
              htmlFor={`comp-${key}`}
              className="flex items-center gap-2.5 min-h-[44px] px-1 rounded-md hover:bg-muted cursor-pointer"
            >
              <Checkbox
                id={`comp-${key}`}
                checked={selectedComps.includes(key)}
                onCheckedChange={(checked) => {
                  setSelectedComps(prev =>
                    checked ? [...prev, key] : prev.filter(c => c !== key)
                  );
                }}
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
        <Button onClick={handleSaveCompetitions} disabled={compLoading} variant="outline">
          {compLoading ? t('profile.saving') : t('profile.saveCompetitions')}
        </Button>
      </div>

      <Separator />

      {/* Security section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">{t('profile.securityTitle')}</h2>

        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-sm">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">{t('profile.currentPasswordLabel')}</Label>
            <Input
              id="currentPassword"
              type="password"
              required
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">{t('profile.newPasswordLabel')}</Label>
            <Input
              id="newPassword"
              type="password"
              required
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder={t('profile.passwordPlaceholder')}
            />
            <PasswordStrength password={newPassword} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('profile.confirmPasswordLabel')}</Label>
            <Input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" disabled={pwLoading}>
            {pwLoading ? t('profile.saving') : t('profile.changePassword')}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t('profile.logoutNotice')}
          </p>
        </form>
      </div>
    </div>
  );
}
