import { Router } from 'express';

import { asyncHandler } from '../../../http/asyncHandler';
import { authRateLimiter } from '../../../http/middleware/rateLimit';
import { requireTenant } from '../../../http/middleware/tenant';
import { devicesV2Repository, hashFingerprint } from '../../devices/devices.repository';
import { created, ok } from '../envelope';
import { validateV2 } from '../validate';
import { RegisterDeviceV2Schema } from '../schemas';

export function buildDevicesV2Router(): Router {
    const router = Router();

    // POST /api/v2/devices/register
    router.post(
        '/register',
        authRateLimiter,
        requireTenant,
        validateV2(RegisterDeviceV2Schema, 'body'),
        asyncHandler(async (req, res) => {
            const body = req.body as {
                platform: 'android';
                device_name?: string;
                device_fingerprint: string;
                fcm_token?: string;
                app_version?: string;
                os_version?: string;
            };

            const existing = await devicesV2Repository.findByFingerprintHash(
                hashFingerprint(body.device_fingerprint)
            );

            const row = await devicesV2Repository.upsert({
                platform: body.platform,
                deviceName: body.device_name,
                deviceFingerprint: body.device_fingerprint,
                fcmToken: body.fcm_token,
                appVersion: body.app_version,
                osVersion: body.os_version
            });

            const payload = {
                device: {
                    id: row.id,
                    platform: row.platform,
                    device_name: row.deviceName,
                    is_active: row.isActive,
                    last_seen_at: row.lastSeenAt.toISOString()
                }
            };

            if (existing) ok(res, payload);
            else created(res, payload);
        })
    );

    return router;
}
