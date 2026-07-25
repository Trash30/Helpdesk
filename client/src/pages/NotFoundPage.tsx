import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  const { t } = useTranslation('common');
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="text-center space-y-4">
        <p className="text-8xl font-bold text-muted-foreground">404</p>
        <h1 className="text-2xl font-semibold">{t('notFound.title')}</h1>
        <p className="text-muted-foreground">{t('notFound.description')}</p>
        <Button asChild>
          <Link to="/dashboard">{t('notFound.backToDashboard')}</Link>
        </Button>
      </div>
    </div>
  );
}
