import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app';

describe('GET /health', () => {
    it('returns ok envelope', async () => {
        const app = createApp();
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ status: 'ok', service: 'spotfix-community-api' });
        expect(res.headers['x-request-id']).toBeDefined();
    });
});

describe('GET /api/v1', () => {
    it('returns API metadata without auth', async () => {
        const app = createApp();
        const res = await request(app).get('/api/v1');
        expect(res.status).toBe(200);
        expect(res.body.name).toBe('SpotFix Community API');
        expect(res.body.supportedVersions).toContain('v1');
    });
});

describe('legacy /api alias', () => {
    it('sets Deprecation/Sunset headers', async () => {
        const app = createApp();
        // Hitting an undefined /api/* path still goes through the deprecation
        // middleware before falling through to notFoundHandler.
        const res = await request(app).get('/api/users');
        expect(res.headers.deprecation).toBe('true');
        expect(res.headers.sunset).toBeDefined();
    });
});

describe('unknown route', () => {
    it('returns NOT_FOUND envelope', async () => {
        const app = createApp();
        const res = await request(app).get('/does-not-exist');
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('NOT_FOUND');
        expect(res.body.error.requestId).toBeDefined();
    });
});

describe('GET /api/v1/openapi.json', () => {
    it('returns the zod-generated OpenAPI 3 document', async () => {
        const app = createApp();
        const res = await request(app).get('/api/v1/openapi.json');
        expect(res.status).toBe(200);
        expect(res.body.openapi).toMatch(/^3\./);
        expect(res.body.info?.title).toBe('SpotFix Community API');
        // A few representative paths must exist.
        expect(res.body.paths['/users/login']).toBeDefined();
        expect(res.body.paths['/users/google']).toBeDefined();
        expect(res.body.paths['/devices/register']).toBeDefined();
        expect(res.body.paths['/reports/{id}/photos/presign']).toBeDefined();
        expect(res.body.components?.schemas?.LoginResponse).toBeDefined();
        expect(res.body.components?.schemas?.DeviceRegistrationResponse).toBeDefined();
        expect(res.body.components?.schemas?.PresignPhotoResponse).toBeDefined();
    });
});
