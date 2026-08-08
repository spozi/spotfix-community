import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app';

describe('GET /api/v2', () => {
    it('returns v2 metadata with success envelope', async () => {
        const app = createApp();
        const res = await request(app).get('/api/v2');
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            success: true,
            data: { name: 'SpotFix Community API', version: 'v2' }
        });
        expect(res.body.data.supportedVersions).toContain('v2');
    });
});

describe('GET /api/v2/unknown', () => {
    it('returns v2 error envelope on not-found', async () => {
        const app = createApp();
        const res = await request(app).get('/api/v2/this-does-not-exist');
        expect(res.status).toBe(404);
        expect(res.body).toMatchObject({
            success: false,
            error: expect.objectContaining({ code: expect.any(String) })
        });
    });
});

describe('POST /api/v2/auth/login', () => {
    it('rejects malformed body with v2 VALIDATION_ERROR envelope', async () => {
        const app = createApp();
        const res = await request(app)
            .post('/api/v2/auth/login')
            .send({})
            .set('Content-Type', 'application/json');
        // No tenant header => UNAUTHENTICATED-style tenant error first OR validation.
        expect([400, 401]).toContain(res.status);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBeDefined();
        expect(typeof res.body.error.code).toBe('string');
    });
});

describe('GET /api/v2/me without token', () => {
    it('returns 401 UNAUTHENTICATED', async () => {
        const app = createApp();
        const res = await request(app).get('/api/v2/me');
        expect(res.status).toBe(401);
        expect(res.body).toMatchObject({
            success: false,
            error: { code: 'UNAUTHENTICATED' }
        });
    });
});

describe('v2 stage 2 routes require auth', () => {
    const protectedRoutes: Array<[string, string]> = [
        ['get', '/api/v2/reports/my'],
        ['post', '/api/v2/reports'],
        ['get', '/api/v2/reports/some-id'],
        ['get', '/api/v2/supervisor/dashboard'],
        ['get', '/api/v2/supervisor/reports'],
        ['get', '/api/v2/cleaner/tasks'],
        ['patch', '/api/v2/cleaner/tasks/some-id/accept'],
        ['patch', '/api/v2/cleaner/tasks/some-id/reject'],
        ['patch', '/api/v2/cleaner/tasks/some-id/start'],
        ['patch', '/api/v2/cleaner/tasks/some-id/resolve'],
        ['get', '/api/v2/admin/users'],
        ['get', '/api/v2/sync/events'],
        ['get', '/api/v2/notifications'],
        ['patch', '/api/v2/notifications/some-id/read'],
        ['post', '/api/v2/admin/users/some-user/roles'],
        ['post', '/api/v2/uploads/presign']
    ];

    for (const [method, path] of protectedRoutes) {
        it(`${method.toUpperCase()} ${path} → 401 UNAUTHENTICATED`, async () => {
            const app = createApp();
            const agent = request(app);
            const res = await (method === 'post'
                ? agent.post(path).send({})
                : method === 'patch'
                    ? agent.patch(path).send({})
                    : agent.get(path));
            expect(res.status).toBe(401);
            expect(res.body).toMatchObject({
                success: false,
                error: { code: 'UNAUTHENTICATED' }
            });
        });
    }
});

describe('POST /api/v2/auth/google', () => {
    it('rejects malformed body with v2 envelope error', async () => {
        const app = createApp();
        const res = await request(app)
            .post('/api/v2/auth/google')
            .send({})
            .set('Content-Type', 'application/json');
        expect([400, 401]).toContain(res.status);
        expect(res.body.success).toBe(false);
        expect(typeof res.body.error.code).toBe('string');
    });

    it('rejects payload missing id_token even with device_id', async () => {
        const app = createApp();
        const res = await request(app)
            .post('/api/v2/auth/google')
            .send({ device_id: 'd_test' })
            .set('Content-Type', 'application/json');
        expect([400, 401]).toContain(res.status);
        expect(res.body.success).toBe(false);
    });
});

describe('POST /api/v2/auth/login rejects id_number-only payload', () => {
    it('returns validation error when only id_number is provided', async () => {
        const app = createApp();
        const res = await request(app)
            .post('/api/v2/auth/login')
            .send({ device_id: 'd_test', id_number: 'A123', password: 'x' })
            .set('Content-Type', 'application/json');
        expect([400, 401]).toContain(res.status);
        expect(res.body.success).toBe(false);
    });
});
