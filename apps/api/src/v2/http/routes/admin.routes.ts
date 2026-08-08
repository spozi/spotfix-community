import { Router } from 'express';

import { asyncHandler } from '../../../http/asyncHandler';
import { assignRoleToUser, listAdminUsers } from '../../admin/admin.service';
import { requireV2Auth, requireV2Role } from '../auth.middleware';
import { ok } from '../envelope';
import { AdminAssignRoleSchema, AdminListUsersQuerySchema } from '../schemas';
import { validateV2 } from '../validate';

function serializeAdminUser(user: {
    id: string;
    name: string;
    email: string | null;
    idNumber: string;
    status: string;
    roles: { reporter: boolean; supervisor: boolean; cleaner: boolean; admin: boolean };
}) {
    return {
        id: user.id,
        name: user.name,
        email: user.email ?? undefined,
        id_number: user.idNumber,
        status: user.status,
        roles: user.roles
    };
}

export function buildAdminV2Router(): Router {
    const router = Router();
    router.use(requireV2Auth, requireV2Role('admin'));

    // GET /api/v2/admin/users
    router.get(
        '/users',
        validateV2(AdminListUsersQuerySchema, 'query'),
        asyncHandler(async (req, res) => {
            const q = req.query as { search?: string; limit?: number };
            const users = await listAdminUsers({
                search: q.search,
                limit: q.limit
            });
            ok(res, { users: users.map(serializeAdminUser) });
        })
    );

    // POST /api/v2/admin/users/:id/roles
    router.post(
        '/users/:id/roles',
        validateV2(AdminAssignRoleSchema, 'body'),
        asyncHandler(async (req, res) => {
            const body = req.body as { role: 'supervisor' | 'cleaner' };
            const role = body.role;
            const user = await assignRoleToUser(String(req.params.id), role);
            ok(res, {
                user: serializeAdminUser(user),
                message: `${role} role assigned.`
            });
        })
    );

    return router;
}