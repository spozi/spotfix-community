import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantStore {
    tenantId: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantStore>();

export function currentTenantId(): string | undefined {
    return tenantStorage.getStore()?.tenantId;
}

/**
 * Mutates the current async-local context for the rest of this request.
 * Express middleware contexts propagate through Node's HTTP server, so a single
 * `enterWith` per request is sufficient — no need to wrap downstream handlers.
 */
export function enterTenant(tenantId: string): void {
    tenantStorage.enterWith({ tenantId });
}
