import { Router } from 'express';

import { devicesService } from '../../domain/devices/devices.service';
import { asyncHandler } from '../asyncHandler';
import { requireAuth, requireRoles } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { RegisterDeviceSchema, UnregisterDeviceSchema } from '../schemas';

export function buildDevicesRouter(): Router {
    const router = Router();

    router.post(
        '/register',
        requireAuth,
        requireRoles('public', 'supervisor', 'cleaner', 'master'),
        validate(RegisterDeviceSchema, 'body'),
        asyncHandler(async (req, res) => {
            res.json(await devicesService.register({ authType: req.auth!.authType, userId: req.auth!.userId }, req.body));
        })
    );

    router.post(
        '/unregister',
        requireAuth,
        requireRoles('public', 'supervisor', 'cleaner', 'master'),
        validate(UnregisterDeviceSchema, 'body'),
        asyncHandler(async (req, res) => {
            res.json(await devicesService.unregister({ authType: req.auth!.authType, userId: req.auth!.userId }, req.body));
        })
    );

    return router;
}
