import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { usePermissions } from '@/hooks/usePermissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
}

export function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
  const { isAuthenticated, mustChangePassword } = useAuthStore();
  const { can } = usePermissions();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (mustChangePassword) return <Navigate to="/change-password" replace />;
  if (requiredPermission && !can(requiredPermission)) return <Navigate to="/403" replace />;

  return <>{children}</>;
}
