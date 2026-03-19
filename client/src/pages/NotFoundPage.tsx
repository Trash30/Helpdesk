import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="text-center space-y-4">
        <p className="text-8xl font-bold text-muted-foreground">404</p>
        <h1 className="text-2xl font-semibold">Page introuvable</h1>
        <p className="text-muted-foreground">La page que vous cherchez n'existe pas.</p>
        <Button asChild>
          <Link to="/dashboard">Retour au tableau de bord</Link>
        </Button>
      </div>
    </div>
  );
}
