import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** RBAC marker. Combine with `RolesGuard` to gate by role(s). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
