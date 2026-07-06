export function getDashboardRouteForRoles(roles: string[] = []): string {
  if (roles.includes('ROLE_ADMIN')) return '/homeadmin';
  if (roles.includes('ROLE_ORGANISATEUR')) return '/dashorg';
  if (roles.includes('ROLE_EXPERT')) return '/mentor';
  if (roles.includes('ROLE_ENTREPRENEUR')) return '/startups';
  if (roles.includes('ROLE_USER')) return '/dashuser';
  return '/dashboard';
}

export function normalizeRoles(rawRoles: any): string[] {
  if (!Array.isArray(rawRoles)) return [];

  return rawRoles
    .map((role) => {
      if (typeof role === 'string') return role;
      return role?.name || role?.authority || '';
    })
    .filter((role): role is string => !!role);
}
