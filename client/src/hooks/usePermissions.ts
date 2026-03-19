import { useAuthStore } from '@/stores/authStore';

export function usePermissions() {
  const permissions = useAuthStore((s) => s.permissions);

  const can = (perm: string): boolean => permissions.includes(perm);

  const canAny = (...perms: string[]): boolean => perms.some((p) => permissions.includes(p));

  const canAll = (...perms: string[]): boolean => perms.every((p) => permissions.includes(p));

  return { can, canAny, canAll, permissions };
}
