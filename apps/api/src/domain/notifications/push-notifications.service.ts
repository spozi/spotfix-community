import { GoogleAuth } from 'google-auth-library';

import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { devicesRepository } from '../devices/devices.repository';
import { notificationHistoryService } from './notification-history.service';

interface PushNotificationInput {
    userIds?: string[];
    masterUserIds?: string[];
    reportId: string;
    type: string;
    title: string;
    body: string;
    data?: Record<string, string>;
    isCritical?: boolean;
}

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

interface FcmServiceAccount {
    projectId: string;
    clientEmail: string;
    privateKey: string;
}

interface FcmClient {
    projectId: string;
    auth: GoogleAuth;
}

let configurationWarningLogged = false;

function logConfigurationWarning(message: string, error?: unknown) {
    if (configurationWarningLogged) {
        if (error) {
            logger.debug({ err: error }, message);
        }
        return;
    }

    configurationWarningLogged = true;
    logger.warn({ err: error }, message);
}

function resolveServiceAccount(): FcmServiceAccount | null {
    if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        const parsed = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON) as Record<string, unknown>;
        const projectId = String(parsed.projectId ?? parsed.project_id ?? '').trim();
        const clientEmail = String(parsed.clientEmail ?? parsed.client_email ?? '').trim();
        const privateKey = String(parsed.privateKey ?? parsed.private_key ?? '').replace(/\\n/g, '\n');
        if (!projectId || !clientEmail || !privateKey) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is missing project, client email, or private key fields.');
        }
        return { projectId, clientEmail, privateKey };
    }

    if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
        return {
            projectId: env.FIREBASE_PROJECT_ID,
            clientEmail: env.FIREBASE_CLIENT_EMAIL,
            privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        };
    }

    return null;
}

function getFcmClient(): FcmClient | null {
    try {
        const serviceAccount = resolveServiceAccount();
        const projectId = serviceAccount?.projectId ?? env.FIREBASE_PROJECT_ID;
        if (!projectId) {
            logConfigurationWarning('Firebase Cloud Messaging credentials are not configured; skipping push delivery.');
            return null;
        }

        if (serviceAccount) {
            return {
                projectId,
                auth: new GoogleAuth({
                    credentials: {
                        project_id: serviceAccount.projectId,
                        client_email: serviceAccount.clientEmail,
                        private_key: serviceAccount.privateKey
                    },
                    scopes: [FCM_SCOPE]
                })
            };
        }

        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            return {
                projectId,
                auth: new GoogleAuth({ scopes: [FCM_SCOPE] })
            };
        }

        logConfigurationWarning('Firebase Cloud Messaging credentials are not configured; skipping push delivery.');
        return null;
    } catch (error) {
        logConfigurationWarning('Firebase Cloud Messaging is configured incorrectly; skipping push delivery.', error);
        return null;
    }
}

function isInvalidFcmToken(payload: unknown): boolean {
    if (!payload || typeof payload !== 'object') return false;
    const error = (payload as { error?: unknown }).error;
    if (!error || typeof error !== 'object') return false;
    const details = (error as { details?: unknown }).details;
    if (!Array.isArray(details)) return false;
    return details.some((detail) => {
        if (!detail || typeof detail !== 'object') return false;
        const errorCode = (detail as { errorCode?: unknown }).errorCode;
        return errorCode === 'UNREGISTERED';
    });
}

async function sendFcmMessage(input: {
    client: FcmClient;
    accessToken: string;
    token: string;
    title: string;
    body: string;
    data: Record<string, string>;
}): Promise<boolean> {
    const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(input.client.projectId)}/messages:send`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${input.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: {
                    token: input.token,
                    notification: {
                        title: input.title,
                        body: input.body
                    },
                    data: input.data,
                    android: {
                        priority: 'high',
                        notification: {
                            channel_id: 'spotfix-report-updates'
                        }
                    }
                }
            })
        }
    );

    if (response.ok) return false;

    const payload = await response.json().catch(() => null);
    if (isInvalidFcmToken(payload)) return true;

    logger.warn(
        { status: response.status, projectId: input.client.projectId },
        'FCM HTTP v1 delivery failed'
    );
    return false;
}

function chunk<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
}

export const pushNotificationsService = {
    async sendToUsers(input: Omit<PushNotificationInput, 'masterUserIds'> & { userIds: string[] }): Promise<void> {
        return pushNotificationsService.sendToRecipients({ ...input, masterUserIds: [] });
    },

    async sendToRecipients(input: PushNotificationInput): Promise<void> {
        const userIds = Array.from(new Set(input.userIds?.filter(Boolean) ?? []));
        const masterUserIds = Array.from(new Set(input.masterUserIds?.filter(Boolean) ?? []));
        if (userIds.length === 0 && masterUserIds.length === 0) {
            return;
        }

        try {
            await notificationHistoryService.record({
                userIds,
                masterUserIds,
                reportPublicId: input.reportId,
                type: input.type,
                title: input.title,
                body: input.body,
                payload: {
                    reportId: input.reportId,
                    ...(input.data ?? {})
                },
                isCritical: input.isCritical
            });
        } catch (error) {
            logger.warn(
                { err: error, type: input.type, reportId: input.reportId },
                'notification history persistence failed'
            );
        }

        const client = getFcmClient();
        if (!client) {
            return;
        }

        try {
            const registrations = await devicesRepository.listByRecipientIds({
                userIds,
                masterUserIds
            }, 'android');
            const tokens = Array.from(new Set(registrations.map((device) => device.token).filter(Boolean)));

            if (tokens.length === 0) {
                return;
            }

            const invalidTokens: string[] = [];
            const data = {
                type: input.type,
                reportId: input.reportId,
                title: input.title,
                body: input.body,
                ...(input.data ?? {})
            };

            const accessToken = await client.auth.getAccessToken();
            if (!accessToken) {
                throw new Error('Unable to obtain an access token for Firebase Cloud Messaging.');
            }

            for (const batch of chunk(tokens, 100)) {
                const results = await Promise.all(
                    batch.map((token) => sendFcmMessage({
                        client,
                        accessToken,
                        token,
                        title: input.title,
                        body: input.body,
                        data
                    }))
                );
                results.forEach((invalid, index) => {
                    const token = batch[index];
                    if (invalid && token) invalidTokens.push(token);
                });
            }

            await devicesRepository.deleteByTokens(invalidTokens);
        } catch (error) {
            logger.warn({ err: error, type: input.type, reportId: input.reportId }, 'push notification delivery failed');
        }
    }
};
