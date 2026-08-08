/**
 * scripts/promote-admin.ts
 *
 * One-time bootstrap helper to grant v2 `admin` capability to an existing
 * tenant user account by email.
 *
 * Usage:
 *   PROMOTE_TENANT_SLUG=example-campus \
 *   PROMOTE_ADMIN_EMAIL=ops@example.com \
 *   npm run bootstrap:promote-admin
 *
 * Optional:
 *   PROMOTE_DRY_RUN=true
 */
import { prismaRaw } from '../src/infra/prisma';

function required(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`Missing required env: ${name}`);
    return value;
}

function optional(name: string): string | undefined {
    const value = process.env[name]?.trim();
    return value && value.length > 0 ? value : undefined;
}

function flag(name: string): boolean {
    const value = optional(name);
    if (!value) return false;
    return ['1', 'true', 'yes', 'y', 'on'].includes(value.toLowerCase());
}

interface RoleSet {
    reporter: boolean;
    supervisor: boolean;
    cleaner: boolean;
    admin: boolean;
}

function buildRoleSet(v1Role: string | null | undefined, extraRoles: readonly string[]): RoleSet {
    const roleSet: RoleSet = {
        reporter: true,
        supervisor: false,
        cleaner: false,
        admin: false
    };

    if (v1Role === 'supervisor') roleSet.supervisor = true;
    if (v1Role === 'cleaner') roleSet.cleaner = true;

    for (const role of extraRoles) {
        if (role === 'supervisor') roleSet.supervisor = true;
        if (role === 'cleaner') roleSet.cleaner = true;
        if (role === 'admin') roleSet.admin = true;
    }

    return roleSet;
}

async function main(): Promise<void> {
    const dryRun = flag('PROMOTE_DRY_RUN');
    const tenantSlug =
        optional('PROMOTE_TENANT_SLUG') ??
        optional('BOOTSTRAP_TENANT_SLUG') ??
        optional('DEFAULT_TENANT_SLUG');
    if (!tenantSlug) {
        throw new Error(
            'Missing required env: PROMOTE_TENANT_SLUG (or BOOTSTRAP_TENANT_SLUG / DEFAULT_TENANT_SLUG)'
        );
    }

    const email = required('PROMOTE_ADMIN_EMAIL').toLowerCase();

    const tenant = await prismaRaw.tenant.findUnique({
        where: { slug: tenantSlug },
        select: { id: true, slug: true, name: true }
    });
    if (!tenant) {
        throw new Error(`Tenant not found for slug '${tenantSlug}'.`);
    }

    const user = await prismaRaw.userAccount.findFirst({
        where: {
            tenantId: tenant.id,
            email: { equals: email, mode: 'insensitive' },
            status: 'active'
        },
        select: {
            id: true,
            name: true,
            email: true,
            idNumber: true,
            role: true,
            status: true
        }
    });

    if (!user) {
        throw new Error(`Active user with email '${email}' not found in tenant '${tenantSlug}'.`);
    }

    const roleRowsBefore = await prismaRaw.userRoleV2.findMany({
        where: { tenantId: tenant.id, userId: user.id },
        select: { role: true }
    });
    const before = buildRoleSet(user.role, roleRowsBefore.map((row) => row.role));

    let action: 'already_admin' | 'promoted' | 'dry_run_would_promote' = 'already_admin';
    if (!before.admin) {
        if (dryRun) {
            action = 'dry_run_would_promote';
        } else {
            await prismaRaw.userRoleV2.upsert({
                where: {
                    tenantId_userId_role: {
                        tenantId: tenant.id,
                        userId: user.id,
                        role: 'admin'
                    }
                },
                update: {},
                create: {
                    tenantId: tenant.id,
                    userId: user.id,
                    role: 'admin'
                }
            });
            action = 'promoted';
        }
    }

    const roleRowsAfter = dryRun
        ? roleRowsBefore
        : await prismaRaw.userRoleV2.findMany({
            where: { tenantId: tenant.id, userId: user.id },
            select: { role: true }
        });
    const after = buildRoleSet(user.role, roleRowsAfter.map((row) => row.role));

    // eslint-disable-next-line no-console
    console.log(
        `ADMIN_PROMOTION_SUMMARY ${JSON.stringify({
            dryRun,
            tenant: {
                id: tenant.id,
                slug: tenant.slug,
                name: tenant.name
            },
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                idNumber: user.idNumber,
                status: user.status
            },
            action,
            roles: { before, after }
        })}`
    );
}

main()
    .then(() => prismaRaw.$disconnect())
    .catch(async (err) => {
        // eslint-disable-next-line no-console
        console.error(err);
        await prismaRaw.$disconnect();
        process.exit(1);
    });
