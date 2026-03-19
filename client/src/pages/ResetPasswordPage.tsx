import { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useBranding } from '@/hooks/useBranding';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordStrength } from '@/components/ui/PasswordStrength';
import api from '@/lib/axios';

export function ResetPasswordPage() {
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
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword, confirmPassword });
      setDone(true);
      toast.success('Mot de passe mis à jour');
      setTimeout(() => navigate('/login', { replace: true }), 3000);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Erreur lors de la réinitialisation');
    } finally {
      setLoading(false);
    }
  };

  const reasonMessages: Record<string, string> = {
    expired: 'Ce lien de réinitialisation a expiré. Demandez un nouveau lien à votre administrateur.',
    invalid: 'Ce lien est invalide ou a déjà été utilisé.',
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          {logoUrl && <img src={logoUrl} alt={companyName} className="max-h-16 max-w-[180px] object-contain" />}
          <p className="font-semibold text-foreground">{companyName}</p>
        </div>

        <div className="bg-card rounded-lg border shadow-sm p-6 space-y-4">
          <h1 className="text-lg font-semibold">Réinitialisation du mot de passe</h1>

          {validating && <p className="text-sm text-muted-foreground">Vérification du lien...</p>}

          {!validating && !tokenValid && (
            <div className="space-y-3">
              <p className="text-sm text-destructive">{reasonMessages[tokenReason] ?? reasonMessages.invalid}</p>
              <p className="text-sm text-muted-foreground">Contactez votre administrateur pour obtenir un nouveau lien.</p>
            </div>
          )}

          {!validating && tokenValid && !done && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {userEmail && <p className="text-sm text-muted-foreground">Compte : <strong>{userEmail}</strong></p>}
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                <Input
                  id="newPassword"
                  type="password"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min. 8 caractères, 1 majuscule, 1 chiffre"
                />
                <PasswordStrength password={newPassword} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Enregistrement...' : 'Réinitialiser le mot de passe'}
              </Button>
            </form>
          )}

          {done && (
            <div className="space-y-2">
              <p className="text-sm text-green-600 font-medium">Mot de passe mis à jour avec succès.</p>
              <p className="text-sm text-muted-foreground">Redirection vers la page de connexion...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
