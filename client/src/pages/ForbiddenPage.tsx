import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ForbiddenPage() {
  const { t } = useTranslation('common');
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="text-center space-y-4">
        <ShieldX className="mx-auto h-16 w-16 text-destructive opacity-60" />
        <h1 className="text-2xl font-semibold">{t('forbidden.title')}</h1>
        <p className="text-muted-foreground">{t('forbidden.description')}</p>
        <Button asChild variant="outline">
          <Link to="/dashboard">{t('forbidden.backToDashboard')}</Link>
        </Button>
      </div>
    </div>
  );
}
