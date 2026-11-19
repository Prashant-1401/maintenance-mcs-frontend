import { PermissionTier } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  tier: PermissionTier;
}
