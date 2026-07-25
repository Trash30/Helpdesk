import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordStrength } from '@/components/ui/PasswordStrength';
import api from '@/lib/axios';

export function ChangePasswordPage() {
  const { t } = useTranslation('auth');
  const { setMustChangePassword, user } = useAuthStore();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t('changePassword.passwordMismatch'));
      return;
    }
    setLoading(true);
    try {
      await api.patch('/auth/change-password', {
        newPassword,
        confirmPassword,
      });
      setMustChangePassword(false);
      toast.success(t('changePassword.successToast'));
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? t('changePassword.changeError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm bg-card rounded-lg border shadow-sm p-6 space-y-5">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">{t('changePassword.title')}</h1>
          {user && (
            <p className="text-sm text-muted-foreground">{t('changePassword.greeting', { firstName: user.firstName })}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">{t('changePassword.newPasswordLabel')}</Label>
            <Input
              id="newPassword"
              type="password"
              required
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder={t('changePassword.passwordPlaceholder')}
            />
            <PasswordStrength password={newPassword} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('changePassword.confirmPasswordLabel')}</Label>
            <Input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder={t('changePassword.confirmPlaceholder')}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t('changePassword.submitting') : t('changePassword.submit')}
          </Button>
        </form>
      </div>
    </div>
  );
}
