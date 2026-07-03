import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
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
] as const;

export function ProfilePage() {
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
      toast.success('Compétitions suivies mises à jour');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Erreur lors de l\'enregistrement des compétitions');
    } finally {
      setCompLoading(false);
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }
    setPwLoading(true);
    try {
      await api.patch('/auth/change-password', { currentPassword, newPassword, confirmPassword });
      toast.success('Mot de passe mis à jour. Reconnexion requise.');
      try { await api.post('/auth/logout'); } catch {}
      logout();
      navigate('/login', { replace: true });
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Erreur lors du changement de mot de passe');
    } finally {
      setPwLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Mon profil</h1>

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
        <h2 className="text-lg font-semibold">Compétitions suivies</h2>
        <p className="text-sm text-muted-foreground">
          Sélectionnez les championnats pour lesquels vous assurez le support.
          Seuls ces événements apparaîtront dans votre widget sports.
          Si aucune compétition n'est sélectionnée, toutes sont affichées.
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
          {compLoading ? 'Enregistrement...' : 'Enregistrer les compétitions'}
        </Button>
      </div>

      <Separator />

      {/* Security section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Sécurité</h2>

        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-sm">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Mot de passe actuel</Label>
            <Input
              id="currentPassword"
              type="password"
              required
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
            />
          </div>
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
          <Button type="submit" variant="outline" disabled={pwLoading}>
            {pwLoading ? 'Enregistrement...' : 'Changer le mot de passe'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Après le changement, vous serez déconnecté et redirigé vers la page de connexion.
          </p>
        </form>
      </div>
    </div>
  );
}
