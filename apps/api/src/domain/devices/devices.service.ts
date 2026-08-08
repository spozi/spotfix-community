import type { RegisterDeviceInput, UnregisterDeviceInput } from '../../http/schemas';
import { devicesRepository } from './devices.repository';

export const devicesService = {
    async register(actor: { authType: 'user' | 'master'; userId: string }, input: RegisterDeviceInput): Promise<{ success: true }> {
        await devicesRepository.upsert({
            userId: actor.authType === 'user' ? actor.userId : undefined,
            masterUserId: actor.authType === 'master' ? actor.userId : undefined,
            token: input.token.trim(),
            platform: input.platform,
            appVersion: input.appVersion?.trim() || undefined,
            deviceId: input.deviceId?.trim() || undefined,
            deviceName: input.deviceName?.trim() || undefined,
            notificationsEnabled: input.notificationsEnabled ?? true
        });

        return { success: true };
    },

    async unregister(actor: { authType: 'user' | 'master'; userId: string }, input: UnregisterDeviceInput): Promise<{ success: true }> {
        await devicesRepository.deleteForPrincipalToken({
            userId: actor.authType === 'user' ? actor.userId : undefined,
            masterUserId: actor.authType === 'master' ? actor.userId : undefined,
            token: input.token.trim()
        });
        return { success: true };
    }
};
