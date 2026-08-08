/**
 * v2 role model — see android_v2_api_v2.md §5.
 *
 *   reporter   — always true for any active user
 *   supervisor — opt-in
 *   cleaner    — opt-in
 *   admin      — opt-in
 *
 * Backed by table `UserRoleV2`, but also lifts the existing v1
 * `UserAccount.role` column into v2 capabilities so existing v1 users (with
 * role = supervisor|cleaner|public) work in v2 without a data migration.
 */
import { prisma } from '../../infra/prisma';
import { ForbiddenRoleError } from '../errors';

export const V2_ROLES = ['reporter', 'supervisor', 'cleaner', 'admin'] as const;
export type V2Role = (typeof V2_ROLES)[number];

export interface V2RoleSet {
    reporter: boolean;
    supervisor: boolean;
    cleaner: boolean;
    admin: boolean;
}

export interface V2RolesResult {
    roles: V2RoleSet;
    defaultRole: V2Role;
}

function isV2Role(value: unknown): value is V2Role {
    return typeof value === 'string' && (V2_ROLES as ReadonlyArray<string>).includes(value);
}

export function buildRoleSet(v1Role: string | null | undefined, extraRoles: readonly string[]): V2RoleSet {
    const set: V2RoleSet = {
        reporter: true,
        supervisor: false,
        cleaner: false,
        admin: false
    };

    if (v1Role === 'supervisor') set.supervisor = true;
    if (v1Role === 'cleaner') set.cleaner = true;

    for (const role of extraRoles) {
        if (isV2Role(role)) set[role] = true;
    }

    // Reporter capability cannot be removed.
    set.reporter = true;
    return set;
}

/**
 * Compute the role set for a user. Reporter is always true for active users.
 * Adds capabilities derived from:
 *   - UserAccount.role (v1 column: public|supervisor|cleaner)
 *   - UserRoleV2 rows  (v2 extension table)
 */
export async function loadUserRoles(userId: string, v1Role: string | null | undefined): Promise<V2RolesResult> {
    const rows = await prisma.userRoleV2.findMany({
        where: { userId },
        select: { role: true }
    });
    const set = buildRoleSet(v1Role, rows.map((row) => row.role));
    return { roles: set, defaultRole: 'reporter' };
}

export function assertHasRole(roles: V2RoleSet, required: V2Role): void {
    if (!roles[required]) {
        throw new ForbiddenRoleError(`This action requires ${required} permission.`);
    }
}
