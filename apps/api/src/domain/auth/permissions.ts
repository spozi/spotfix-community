export type UserRole = 'public' | 'supervisor' | 'cleaner';
export type AuthRole = UserRole | 'master';
export type AuthType = 'user' | 'master';

export const USER_ROLES: ReadonlyArray<UserRole> = ['public', 'supervisor', 'cleaner'];

export function normalizeUserRole(value: unknown): UserRole {
    const v = typeof value === 'string' ? value.toLowerCase() : '';
    return (USER_ROLES as ReadonlyArray<string>).includes(v) ? (v as UserRole) : 'public';
}

export function getPermissionsForRole(role: AuthRole): string[] {
    switch (role) {
    case 'master':
        return [
            'profile:read:self',
            'users:list',
            'users:read',
            'users:provision:any',
            'cleaners:list',
            'cleaners:create',
            'cleaners:assign',
            'cleaners:reassign',
            'reports:read:all',
            'reports:update',
            'supervisors:read:any',
            'master:create',
            'master:refresh',
            'master:logout'
        ];
    case 'supervisor':
        return [
            'profile:read:self',
            'users:list',
            'users:read',
            'users:provision:cleaner',
            'cleaners:list',
            'cleaners:create',
            'cleaners:assign',
            'cleaners:reassign',
            'supervisors:read:self',
            'reports:read:all',
            'reports:update',
            'auth:refresh',
            'auth:logout'
        ];
    case 'cleaner':
        return [
            'profile:read:self',
            'reports:read:all',
            'reports:update',
            'auth:refresh',
            'auth:logout'
        ];
    default:
        return [
            'profile:read:self',
            'reports:create',
            'reports:read:self',
            'auth:refresh',
            'auth:logout'
        ];
    }
}
