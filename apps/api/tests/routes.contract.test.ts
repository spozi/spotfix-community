import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
    tenantFindUnique: vi.fn(),
    fromAccessToken: vi.fn(),
    fromRefreshToken: vi.fn(),
    loginUser: vi.fn(),
    loginMaster: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    googleSignIn: vi.fn(),
    registerPublic: vi.fn(),
    provisionUser: vi.fn(),
    listUsers: vi.fn(),
    getPublicProfile: vi.fn(),
    findUserById: vi.fn(),
    findMasterById: vi.fn(),
    createMaster: vi.fn(),
    listReports: vi.fn(),
    getPublicStatusBoard: vi.fn(),
    getReportById: vi.fn(),
    createReport: vi.fn(),
    updateReport: vi.fn(),
    listReportsForUser: vi.fn(),
    attachPhotoKey: vi.fn(),
    presignUploadUrl: vi.fn(),
    ingestPhotoString: vi.fn(),
    listCleaners: vi.fn(),
    createCleaner: vi.fn(),
    reassignCleaner: vi.fn(),
    assignCleaner: vi.fn(),
    registerDevice: vi.fn(),
    unregisterDevice: vi.fn(),
    listNotifications: vi.fn()
}));

vi.mock('../src/infra/prisma', () => ({
    prismaRaw: {
        tenant: {
            findUnique: mocks.tenantFindUnique
        },
        $on: vi.fn(),
        $connect: vi.fn(),
        $disconnect: vi.fn()
    },
    prisma: {}
}));

vi.mock('../src/domain/auth/auth.service', () => ({
    authService: {
        fromAccessToken: mocks.fromAccessToken,
        fromRefreshToken: mocks.fromRefreshToken,
        loginUser: mocks.loginUser,
        loginMaster: mocks.loginMaster,
        refresh: mocks.refresh,
        logout: mocks.logout
    }
}));

vi.mock('../src/domain/auth/google.service', () => ({
    googleAuthService: {
        signIn: mocks.googleSignIn
    }
}));

vi.mock('../src/domain/users/users.service', () => ({
    usersService: {
        registerPublic: mocks.registerPublic,
        provision: mocks.provisionUser,
        listAll: mocks.listUsers,
        getPublicProfile: mocks.getPublicProfile
    },
    serializeUserAccount: (row: { id: string; name: string; idNumber?: string; role?: string }) => ({
        _id: row.id,
        name: row.name,
        idNumber: row.idNumber ?? 'U-1',
        role: row.role ?? 'public',
        verified: true,
        loginCount: 1,
        status: 'active',
        authProvider: 'password'
    })
}));

vi.mock('../src/domain/users/users.repository', () => ({
    usersRepository: {
        findById: mocks.findUserById
    }
}));

vi.mock('../src/domain/master/master.service', () => ({
    masterService: {
        create: mocks.createMaster
    },
    serializeMaster: (row: { id: string; username: string; name: string }) => ({
        _id: row.id,
        username: row.username,
        name: row.name
    })
}));

vi.mock('../src/domain/master/master.repository', () => ({
    masterRepository: {
        findById: mocks.findMasterById
    }
}));

vi.mock('../src/domain/reports/reports.service', () => ({
    reportsService: {
        list: mocks.listReports,
        getPublicStatusBoard: mocks.getPublicStatusBoard,
        getById: mocks.getReportById,
        create: mocks.createReport,
        update: mocks.updateReport,
        listForUser: mocks.listReportsForUser,
        attachPhotoKey: mocks.attachPhotoKey
    }
}));

vi.mock('../src/domain/photos/photos.service', () => ({
    photosService: {
        presignUploadUrl: mocks.presignUploadUrl,
        ingestPhotoString: mocks.ingestPhotoString
    }
}));

vi.mock('../src/domain/cleaners/cleaners.service', () => ({
    cleanersService: {
        list: mocks.listCleaners,
        create: mocks.createCleaner,
        reassignSupervisor: mocks.reassignCleaner,
        assignToReport: mocks.assignCleaner
    }
}));

vi.mock('../src/domain/devices/devices.service', () => ({
    devicesService: {
        register: mocks.registerDevice,
        unregister: mocks.unregisterDevice
    }
}));

vi.mock('../src/domain/notifications/notification-history.service', () => ({
    notificationHistoryService: {
        listForActor: mocks.listNotifications
    }
}));

import { createApp } from '../src/app';

const envelope = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    tokenType: 'Bearer',
    expiresIn: '12h',
    refreshExpiresIn: '30d'
};

const authContexts = {
    public: {
        userId: 'public-1',
        tenantId: 'tenant-1',
        role: 'public',
        name: 'Public User',
        authType: 'user',
        sessionVersion: 0
    },
    supervisor: {
        userId: 'supervisor-1',
        tenantId: 'tenant-1',
        role: 'supervisor',
        name: 'Supervisor User',
        authType: 'user',
        sessionVersion: 0
    },
    cleaner: {
        userId: 'cleaner-1',
        tenantId: 'tenant-1',
        role: 'cleaner',
        name: 'Cleaner User',
        authType: 'user',
        sessionVersion: 0
    },
    master: {
        userId: 'master-1',
        tenantId: 'tenant-1',
        role: 'master',
        name: 'Master User',
        authType: 'master',
        sessionVersion: 0
    }
} as const;

const userRow = {
    id: 'public-1',
    name: 'Public User',
    idNumber: 'U-1001',
    role: 'public',
    verified: true,
    status: 'active',
    loginCount: 1
};

const masterRow = {
    id: 'master-1',
    username: 'admin',
    name: 'Master User'
};

const report = {
    _id: 'report-row-1',
    id: 'RPT-100001',
    status: 'Reported',
    timestamp: new Date('2026-05-17T08:00:00.000Z'),
    priority: 'Medium',
    category: 'Litter',
    location: 'Library',
    details: 'Bins overflowing',
    userId: 'public-1',
    reporterName: 'Public User',
    photos: []
};

const cleaner = {
    _id: 'cleaner-1',
    name: 'Cleaner User',
    workId: 'C-1001',
    phone: '0123456789',
    isBusy: false,
    assignedTaskId: null,
    status: 'Free',
    timeLeft: 0
};

function bearer(role: keyof typeof authContexts): string {
    return `Bearer ${role}-token`;
}

function expectNoServerError(res: request.Response): void {
    expect(res.status).toBeLessThan(500);
}

describe('v1 route contract', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mocks.tenantFindUnique.mockResolvedValue({ id: 'tenant-1', status: 'active' });
        mocks.fromAccessToken.mockImplementation(async (token: string) => {
            const role = token.replace('-token', '') as keyof typeof authContexts;
            return authContexts[role] ?? authContexts.public;
        });
        mocks.fromRefreshToken.mockResolvedValue(authContexts.public);
        mocks.loginUser.mockResolvedValue({ context: authContexts.public, envelope });
        mocks.loginMaster.mockResolvedValue({ context: authContexts.master, envelope });
        mocks.refresh.mockResolvedValue(envelope);
        mocks.logout.mockResolvedValue(undefined);
        mocks.googleSignIn.mockResolvedValue({
            envelope,
            user: { _id: 'google-user-1', name: 'Google User', idNumber: 'g:1', role: 'public' },
            isNew: false
        });

        mocks.registerPublic.mockResolvedValue({ _id: 'public-1', name: 'Public User', idNumber: 'U-1001', role: 'public' });
        mocks.provisionUser.mockResolvedValue({ _id: 'cleaner-1', name: 'Cleaner User', idNumber: 'C-1001', role: 'cleaner' });
        mocks.listUsers.mockResolvedValue([userRow]);
        mocks.getPublicProfile.mockResolvedValue(userRow);
        mocks.findUserById.mockImplementation(async (id: string) => {
            if (id === 'supervisor-1') {
                return {
                    id: 'supervisor-1',
                    name: 'Supervisor User',
                    idNumber: 'S-1001',
                    role: 'supervisor',
                    verified: true,
                    status: 'active',
                    loginCount: 1
                };
            }
            return userRow;
        });
        mocks.findMasterById.mockResolvedValue(masterRow);
        mocks.createMaster.mockResolvedValue({ _id: 'master-2', username: 'ops-admin', name: 'Ops Admin' });

        mocks.listReports.mockResolvedValue([report]);
        mocks.getPublicStatusBoard.mockResolvedValue({
            generatedAt: '2026-05-17T08:00:00.000Z',
            summary: { total: 1, open: 1, pending: 1, resolved: 0, urgent: 0, cleaners: 1, availableCleaners: 1, busyCleaners: 0 },
            reports: [report],
            cleaners: [cleaner]
        });
        mocks.getReportById.mockResolvedValue(report);
        mocks.createReport.mockResolvedValue(report);
        mocks.updateReport.mockResolvedValue({ ...report, status: 'In Progress' });
        mocks.listReportsForUser.mockResolvedValue([report]);
        mocks.attachPhotoKey.mockResolvedValue({ ...report, evidencePhoto: 'https://media.example/photo.jpg' });
        mocks.presignUploadUrl.mockResolvedValue({
            key: 'tenants/tenant-1/reports/RPT-100001/evidence/photo.jpg',
            uploadUrl: 'https://media.example/upload',
            method: 'PUT',
            headers: { 'Content-Type': 'image/jpeg' },
            expiresIn: 600
        });
        mocks.ingestPhotoString.mockResolvedValue('tenants/tenant-1/reports/RPT-100001/evidence/photo.jpg');

        mocks.listCleaners.mockResolvedValue([cleaner]);
        mocks.createCleaner.mockResolvedValue(cleaner);
        mocks.reassignCleaner.mockResolvedValue({ ...cleaner, supervisorId: 'supervisor-1' });
        mocks.assignCleaner.mockResolvedValue({ ...cleaner, isBusy: true, assignedTaskId: 'RPT-100001', status: 'Busy' });

        mocks.registerDevice.mockResolvedValue({ success: true });
        mocks.unregisterDevice.mockResolvedValue({ success: true });
        mocks.listNotifications.mockResolvedValue([
            {
                _id: 'notification-1',
                reportId: 'RPT-100001',
                type: 'report_created',
                title: 'New report',
                body: 'A report was created.',
                isCritical: false,
                payload: {},
                createdAt: new Date('2026-05-17T08:00:00.000Z')
            }
        ]);
    });

    it('covers public system and auth endpoints without internal errors', async () => {
        const app = createApp();

        const responses = [
            await request(app).get('/api/v1/health'),
            await request(app).get('/docs'),
            await request(app).get('/openapi.json'),
            await request(app).get('/api'),
            await request(app)
                .post('/api/v1/users/register')
                .set('X-Tenant-Slug', 'example-campus')
                .send({ name: 'Public User', email: 'public@example.com', idNumber: 'U-1001', phone: '0123456789', password: 'secret1' }),
            await request(app)
                .post('/api/v1/users/login')
                .set('X-Tenant-Slug', 'example-campus')
                .send({ idNumber: 'U-1001', password: 'secret1' }),
            await request(app)
                .post('/api/v1/users/google')
                .set('X-Tenant-Slug', 'example-campus')
                .send({ idToken: 'google-id-token' }),
            await request(app)
                .post('/api/v1/users/refresh')
                .send({ refreshToken: 'refresh-token' }),
            await request(app)
                .post('/api/v1/master/login')
                .set('X-Tenant-Slug', 'example-campus')
                .send({ username: 'admin', password: 'secret1' }),
            await request(app)
                .post('/api/v1/master/refresh')
                .send({ refreshToken: 'refresh-token' })
        ];

        responses.forEach(expectNoServerError);
        expect(responses[0].status).toBe(200);
        expect(responses[4].status).toBe(201);
        expect(responses[5].body.authenticated).toBe(true);
        expect(responses[8].body.success).toBe(true);
    });

    it('covers authenticated identity, user, device, notification, and master endpoints', async () => {
        const app = createApp();

        const responses = [
            await request(app).get('/api/v1/me').set('Authorization', bearer('public')),
            await request(app).get('/api/v1/users/public-1').set('Authorization', bearer('public')),
            await request(app).post('/api/v1/users/logout').set('Authorization', bearer('public')).send({}),
            await request(app).post('/api/v1/devices/register').set('Authorization', bearer('public')).send({ token: 'fcm-token' }),
            await request(app).post('/api/v1/devices/unregister').set('Authorization', bearer('public')).send({ token: 'fcm-token' }),
            await request(app).get('/api/v1/notifications').set('Authorization', bearer('public')),
            await request(app)
                .post('/api/v1/users/provision')
                .set('Authorization', bearer('supervisor'))
                .send({ name: 'Cleaner User', idNumber: 'C-1001', phone: '0123456789', password: 'secret1', role: 'cleaner' }),
            await request(app).get('/api/v1/users').set('Authorization', bearer('supervisor')),
            await request(app)
                .post('/api/v1/master/create')
                .set('Authorization', bearer('master'))
                .send({ username: 'ops-admin', password: 'secret1', name: 'Ops Admin' }),
            await request(app).post('/api/v1/master/logout').set('Authorization', bearer('master')).send({})
        ];

        responses.forEach(expectNoServerError);
        expect(responses.map((res) => res.status)).toEqual([200, 200, 200, 200, 200, 200, 201, 200, 201, 200]);
        expect(mocks.registerDevice).toHaveBeenCalledWith({ authType: 'user', userId: 'public-1' }, expect.objectContaining({ token: 'fcm-token' }));
        expect(mocks.provisionUser).toHaveBeenCalledWith(expect.objectContaining({ role: 'cleaner' }), { role: 'supervisor' });
    });

    it('covers report and photo endpoints without internal errors', async () => {
        const app = createApp();

        const responses = [
            await request(app).get('/api/v1/reports').set('Authorization', bearer('public')),
            await request(app).get('/api/v1/reports/public/status').set('X-Tenant-Slug', 'example-campus'),
            await request(app).get('/api/v1/reports/RPT-100001').set('Authorization', bearer('public')),
            await request(app)
                .post('/api/v1/reports')
                .set('Authorization', bearer('public'))
                .send({ category: 'Litter', location: 'Library', details: 'Bins overflowing', priority: 'Medium' }),
            await request(app)
                .put('/api/v1/reports/RPT-100001')
                .set('Authorization', bearer('supervisor'))
                .send({ status: 'In Progress' }),
            await request(app).get('/api/v1/reports/user/public-1').set('Authorization', bearer('public')),
            await request(app)
                .post('/api/v1/reports/RPT-100001/photos/presign')
                .set('Authorization', bearer('public'))
                .send({ kind: 'evidence', contentType: 'image/jpeg', contentLength: 128 }),
            await request(app)
                .post('/api/v1/reports/RPT-100001/photos/confirm')
                .set('Authorization', bearer('public'))
                .send({ kind: 'evidence', key: 'tenants/tenant-1/reports/RPT-100001/evidence/photo.jpg' }),
            await request(app)
                .post('/api/v1/reports/RPT-100001/photos')
                .set('Authorization', bearer('public'))
                .send({ kind: 'evidence', dataUrl: 'data:image/jpeg;base64,AAAA' })
        ];

        responses.forEach(expectNoServerError);
        expect(responses.map((res) => res.status)).toEqual([200, 200, 200, 201, 200, 200, 201, 200, 201]);
        expect(mocks.createReport).toHaveBeenCalledWith(
            expect.objectContaining({ role: 'public', userId: 'public-1' }),
            expect.objectContaining({ category: 'Litter' })
        );
        expect(mocks.presignUploadUrl).toHaveBeenCalledWith(expect.objectContaining({ reportId: 'RPT-100001', kind: 'evidence' }));
    });

    it('covers cleaner and supervisor workforce endpoints without internal errors', async () => {
        const app = createApp();

        const responses = [
            await request(app).get('/api/v1/cleaners').set('Authorization', bearer('supervisor')),
            await request(app)
                .post('/api/v1/cleaners')
                .set('Authorization', bearer('supervisor'))
                .send({ name: 'Cleaner User', workId: 'C-1001', phone: '0123456789', workLocation: 'Library' }),
            await request(app)
                .patch('/api/v1/cleaners/cleaner-1/supervisor')
                .set('Authorization', bearer('supervisor'))
                .send({ supervisorId: 'supervisor-1' }),
            await request(app)
                .post('/api/v1/cleaners/cleaner-1/assign')
                .set('Authorization', bearer('supervisor'))
                .send({ reportId: 'RPT-100001' }),
            await request(app).get('/api/v1/supervisors/supervisor-1/cleaners').set('Authorization', bearer('supervisor'))
        ];

        responses.forEach(expectNoServerError);
        expect(responses.map((res) => res.status)).toEqual([200, 201, 200, 200, 200]);
        expect(mocks.assignCleaner).toHaveBeenCalledWith(
            expect.objectContaining({ role: 'supervisor', userId: 'supervisor-1' }),
            'cleaner-1',
            'RPT-100001',
            undefined
        );
    });
});
