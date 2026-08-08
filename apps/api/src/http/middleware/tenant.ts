import type { NextFunction, Request, Response } from 'express';

import { env } from '../../config/env';
import { ValidationError } from '../../errors';
import { prismaRaw } from '../../infra/prisma';
import { currentTenantId, enterTenant } from '../../infra/tenant-context';

const TENANT_HEADER = 'x-tenant-slug';

// Tiny in-process cache for slug→id (slugs rarely churn).
const slugCache = new Map<string, string>();

async function resolveSlugToId(slug: string): Promise<string | null> {
    const cached = slugCache.get(slug);
    if (cached) return cached;

    const tenant = await prismaRaw.tenant.findUnique({
        where: { slug },
        select: { id: true, status: true }
    });

    if (!tenant || tenant.status !== 'active') return null;
    slugCache.set(slug, tenant.id);
    return tenant.id;
}

/**
 * Best-effort tenant resolver. Runs after attachAuth.
 *   1. If req.auth was set (token had tenantId), it's already in the store.
 *   2. Else if X-Tenant-Slug header present, resolve and enter tenant.
 *   3. Else: do nothing — routes that need a tenant will fail at the prisma
 *      extension boundary or via requireTenant.
 */
export function resolveTenant(req: Request, _res: Response, next: NextFunction): void {
    if (req.auth?.tenantId) {
        // attachAuth already called enterTenant when verifying the token.
        return next();
    }

    const headerSlug = req.headers[TENANT_HEADER];
    const normalizedHeaderSlug = typeof headerSlug === 'string' ? headerSlug.trim() : '';
    const fallbackSlug = (env.DEFAULT_TENANT_SLUG ?? '').trim();
    const targetSlug = normalizedHeaderSlug || fallbackSlug;
    if (!targetSlug) return next();

    resolveSlugToId(targetSlug)
        .then((tenantId) => {
            if (tenantId) enterTenant(tenantId);
            next();
        })
        .catch(next);
}

/** Hard requirement: tenant must be in scope. */
export function requireTenant(req: Request, _res: Response, next: NextFunction): void {
    if (req.auth?.tenantId) return next();

    // resolveTenant runs before us and stores tenantId in async-local storage.
    if (currentTenantId()) return next();

    const headerSlug = req.headers[TENANT_HEADER];
    const normalizedHeaderSlug = typeof headerSlug === 'string' ? headerSlug.trim() : '';
    const fallbackSlug = (env.DEFAULT_TENANT_SLUG ?? '').trim();
    const targetSlug = normalizedHeaderSlug || fallbackSlug;

    if (!targetSlug) {
        return next(new ValidationError(`${TENANT_HEADER} header is required for this endpoint`));
    }

    // Requested or fallback slug was present but could not match an active tenant.
    next(new ValidationError(`Unknown or inactive tenant slug: ${targetSlug}`));
}
