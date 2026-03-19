import { Link } from 'react-router-dom';
import { ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ForbiddenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="text-center space-y-4">
        <ShieldX className="mx-auto h-16 w-16 text-destructive opacity-60" />
        <h1 className="text-2xl font-semibold">Accès refusé</h1>
        <p className="text-muted-foreground">Vous n'avez pas les droits nécessaires pour accéder à cette page.</p>
        <Button asChild variant="outline">
          <Link to="/dashboard">Retour au tableau de bord</Link>
        </Button>
      </div>
    </div>
  );
}
