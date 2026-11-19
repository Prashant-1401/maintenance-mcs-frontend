import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { PermissionTier } from '../lib/types';

export function ProtectedRoute({ tiers }: { tiers?: PermissionTier[] }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (tiers && !tiers.includes(user.tier)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
