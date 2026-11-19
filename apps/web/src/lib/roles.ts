import type { PermissionTier } from './types';

export function hasTier(tier: PermissionTier | undefined, allowed: PermissionTier[]): boolean {
  return !!tier && allowed.includes(tier);
}

export const ADMIN_ONLY: PermissionTier[] = ['ADMIN'];
export const ADMIN_MANAGEMENT: PermissionTier[] = ['ADMIN', 'MANAGEMENT'];
export const MAINTENANCE_TEAM: PermissionTier[] = ['ADMIN', 'MANAGEMENT', 'TECHNICIAN'];
