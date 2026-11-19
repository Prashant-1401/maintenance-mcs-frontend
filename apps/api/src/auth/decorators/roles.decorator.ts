import { SetMetadata } from '@nestjs/common';
import { PermissionTier } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...tiers: PermissionTier[]) => SetMetadata(ROLES_KEY, tiers);
