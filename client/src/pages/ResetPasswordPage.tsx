import { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useBranding } from '@/hooks/useBranding';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordStrength } from '@/components/ui/PasswordStrength';
import api from '@/lib/axios';

export function ResetPasswordPage() {
  const { t } = useTranslation('auth');
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { logoUrl, companyName } = useBranding();

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenReason, setTokenReason] = useState<string>('');
  const [userEmail, setUserEmail] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.get(`/auth/validate-reset-token/${token}`)
      .then(res => {
        const d = res.data.data;
        if (d.valid) {
          setTokenValid(true);
          setUserEmail(d.userEmail ?? '');
        } else {
          setTokenReason(d.reason ?? 'invalid');
        }
      })
      .catch(() => setTokenReason('invalid'))
      .finally(() => setValidating(false));
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t('resetPassword.passwordMismatch'));
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword, confirmPassword });
      setDone(true);
      toast.success(t('resetPassword.successToast'));
      setTimeout(() => navigate('/login', { replace: true }), 3000);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? t('resetPassword.resetError'));
    } finally {
      setLoading(false);
    }
  };

  const reasonMessages: Record<string, string> = {
    expired: t('resetPassword.expired'),
    invalid: t('resetPassword.invalid'),
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          {logoUrl && <img src={logoUrl} alt={companyName} className="max-h-16 max-w-[180px] object-contain" />}
          <p className="font-semibold text-foreground">{companyName}</p>
        </div>

        <div className="bg-card rounded-lg border shadow-sm p-6 space-y-4">
          <h1 className="text-lg font-semibold">{t('resetPassword.title')}</h1>

          {validating && <p className="text-sm text-muted-foreground">{t('resetPassword.validating')}</p>}

          {!validating && !tokenValid && (
            <div className="space-y-3">
              <p className="text-sm text-destructive">{reasonMessages[tokenReason] ?? reasonMessages.invalid}</p>
              <p className="text-sm text-muted-foreground">{t('resetPassword.contactAdmin')}</p>
            </div>
          )}

          {!validating && tokenValid && !done && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {userEmail && <p className="text-sm text-muted-foreground">{t('resetPassword.account')} <strong>{userEmail}</strong></p>}
              <div className="space-y-2">
                <Label htmlFor="newPassword">{t('resetPassword.newPasswordLabel')}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder={t('resetPassword.passwordPlaceholder')}
                />
                <PasswordStrength password={newPassword} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('resetPassword.confirmPasswordLabel')}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t('resetPassword.submitting') : t('resetPassword.submit')}
              </Button>
            </form>
          )}

          {done && (
            <div className="space-y-2">
              <p className="text-sm text-green-600 font-medium">{t('resetPassword.successTitle')}</p>
              <p className="text-sm text-muted-foreground">{t('resetPassword.redirecting')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
