import { useEffect } from 'react';
import api from '@/lib/axios';
import { useBrandingStore } from '@/stores/brandingStore';

export function useBranding() {
  const { logoUrl, companyName, loaded, setBranding, setLoaded } = useBrandingStore();

  useEffect(() => {
    if (loaded) return;

    api
      .get('/settings/public')
      .then((res) => {
        const data = res.data?.data ?? {};
        setBranding(data.logo_url ?? null, data.company_name ?? 'HelpDesk');
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
      });
  }, [loaded, setBranding, setLoaded]);

  return { logoUrl, companyName };
}
