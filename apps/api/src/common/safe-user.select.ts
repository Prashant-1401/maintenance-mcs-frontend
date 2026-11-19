/** Reusable Prisma `select` shape that excludes passwordHash from any nested User relation. */
export const SAFE_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
} as const;
