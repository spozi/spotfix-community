/**
 * P6: OpenAPI 3.0 document generated from zod schemas.
 *
 * Replaces the hand-written `legacy-openapi.js` shim from P1. Request schemas
 * come from `http/schemas.ts` (the same ones express routes validate against)
 * so request bodies can never drift from documentation. Response schemas live
 * in `openapi/schemas.ts`.
 */
import {
    OpenApiGeneratorV3,
    OpenAPIRegistry,
    type RouteConfig
} from '@asteasolutions/zod-to-openapi';

// Apply `.openapi()` to ZodType.prototype before any schema below uses it.
import { z } from './zod';

import {
    AssignCleanerSchema,
    ConfirmPhotoSchema,
    CreateCleanerSchema,
    CreateMasterSchema,
    CreateReportSchema,
    GoogleSignInSchema,
    MasterLoginSchema,
    NotificationListQuerySchema,
    PresignPhotoSchema,
    ProvisionUserSchema,
    RegisterDeviceSchema,
    ReassignCleanerSchema,
    RefreshTokenSchema,
    RegisterPublicSchema,
    UnregisterDeviceSchema,
    UpdateReportSchema,
    UploadPhotoSchema,
    UserLoginSchema
} from '../http/schemas';
import {
    ApiInfoSchema,
    AuthEnvelopeSchema,
    CleanerListSchema,
    CleanerSchema,
    DeviceRegistrationResponseSchema,
    ErrorEnvelopeSchema,
    GoogleSignInResponseSchema,
    HealthResponseSchema,
    NotificationEventListSchema,
    LoginResponseSchema,
    LogoutResponseSchema,
    MeResponseSchema,
    PresignPhotoResponseSchema,
    PublicStatusBoardSchema,
    ReportListSchema,
    ReportSchema
} from './schemas';
import { openApiDeprecatedServerUrl, openApiPrimaryServerUrl } from '../config/env';

const registry = new OpenAPIRegistry();

// Security scheme — bearer access tokens issued by /users/login etc.
registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT'
});

// Tenant header used by /register, /login, /master/login, /users/google.
const TenantHeaderParam = registry.registerParameter(
    'TenantSlugHeader',
    z
        .string()
        .openapi({
            param: { name: 'X-Tenant-Slug', in: 'header' },
            description: 'Tenant slug (e.g. "example-campus"). Required for unauthenticated tenant-scoped routes.',
            example: 'example-campus'
        })
);

// Register all referenced request schemas so they show up under
// components.schemas with stable names.
const requestSchemas: ReadonlyArray<readonly [string, z.ZodTypeAny]> = [
    ['RegisterPublicRequest', RegisterPublicSchema],
    ['ProvisionUserRequest', ProvisionUserSchema],
    ['UserLoginRequest', UserLoginSchema],
    ['RefreshTokenRequest', RefreshTokenSchema],
    ['RegisterDeviceRequest', RegisterDeviceSchema],
    ['UnregisterDeviceRequest', UnregisterDeviceSchema],
    ['MasterLoginRequest', MasterLoginSchema],
    ['CreateMasterRequest', CreateMasterSchema],
    ['CreateCleanerRequest', CreateCleanerSchema],
    ['ReassignCleanerRequest', ReassignCleanerSchema],
    ['AssignCleanerRequest', AssignCleanerSchema],
    ['CreateReportRequest', CreateReportSchema],
    ['UpdateReportRequest', UpdateReportSchema],
    ['PresignPhotoRequest', PresignPhotoSchema],
    ['ConfirmPhotoRequest', ConfirmPhotoSchema],
    ['UploadPhotoRequest', UploadPhotoSchema],
    ['GoogleSignInRequest', GoogleSignInSchema]
];
for (const [name, schema] of requestSchemas) {
    registry.register(name, schema);
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const jsonContent = <T extends z.ZodTypeAny>(schema: T) => ({
    content: { 'application/json': { schema } }
});

const errorResponse = (description: string) => ({
    description,
    ...jsonContent(ErrorEnvelopeSchema)
});

const standardErrors = {
    '400': errorResponse('Validation error'),
    '401': errorResponse('Unauthenticated'),
    '403': errorResponse('Forbidden'),
    '404': errorResponse('Not found'),
    '409': errorResponse('Conflict'),
    '429': errorResponse('Rate limited'),
    '500': errorResponse('Internal server error')
} as const;

function route(config: RouteConfig): void {
    registry.registerPath(config);
}

// ────────────────────────────────────────────────────────────────────────────
// Paths
// ────────────────────────────────────────────────────────────────────────────

// System
route({
    method: 'get',
    path: '/',
    tags: ['System'],
    summary: 'API metadata',
    responses: {
        '200': { description: 'Service metadata', ...jsonContent(ApiInfoSchema) }
    }
});

route({
    method: 'get',
    path: '/me',
    tags: ['System'],
    summary: 'Current authenticated principal',
    security: [{ bearerAuth: [] }],
    responses: {
        '200': { description: 'Authenticated principal', ...jsonContent(MeResponseSchema) },
        '401': standardErrors['401']
    }
});

// Users — public + admin
route({
    method: 'post',
    path: '/users/register',
    tags: ['Users'],
    summary: 'Register a new public user',
    request: {
        params: z.object({}),
        headers: z.object({ 'X-Tenant-Slug': TenantHeaderParam }),
        body: { content: { 'application/json': { schema: RegisterPublicSchema } } }
    },
    responses: {
        '201': { description: 'Registered', ...jsonContent(LoginResponseSchema) },
        '400': standardErrors['400'],
        '409': standardErrors['409'],
        '429': standardErrors['429']
    }
});

route({
    method: 'post',
    path: '/users/provision',
    tags: ['Users'],
    summary: 'Provision a staff user (supervisor or cleaner)',
    security: [{ bearerAuth: [] }],
    request: {
        body: { content: { 'application/json': { schema: ProvisionUserSchema } } }
    },
    responses: {
        '201': { description: 'Created', ...jsonContent(LoginResponseSchema) },
        '400': standardErrors['400'],
        '401': standardErrors['401'],
        '403': standardErrors['403']
    }
});

route({
    method: 'post',
    path: '/users/login',
    tags: ['Users'],
    summary: 'Password sign-in for users',
    request: {
        headers: z.object({ 'X-Tenant-Slug': TenantHeaderParam }),
        body: { content: { 'application/json': { schema: UserLoginSchema } } }
    },
    responses: {
        '200': { description: 'Authenticated', ...jsonContent(LoginResponseSchema) },
        '400': standardErrors['400'],
        '401': standardErrors['401'],
        '429': standardErrors['429']
    }
});

route({
    method: 'post',
    path: '/users/google',
    tags: ['Users'],
    summary: 'Google Sign-In (verified ID token)',
    description:
        'Verifies the Google ID token server-side, then either signs in an existing user, links the Google account to a matching email, or provisions a new public user.',
    request: {
        headers: z.object({ 'X-Tenant-Slug': TenantHeaderParam }),
        body: { content: { 'application/json': { schema: GoogleSignInSchema } } }
    },
    responses: {
        '200': { description: 'Existing user signed in', ...jsonContent(GoogleSignInResponseSchema) },
        '201': { description: 'New user created', ...jsonContent(GoogleSignInResponseSchema) },
        '400': standardErrors['400'],
        '401': standardErrors['401'],
        '409': standardErrors['409']
    }
});

route({
    method: 'post',
    path: '/users/refresh',
    tags: ['Users'],
    summary: 'Exchange a refresh token for a new access token',
    request: {
        body: { content: { 'application/json': { schema: RefreshTokenSchema } } }
    },
    responses: {
        '200': { description: 'Refreshed', ...jsonContent(AuthEnvelopeSchema) },
        '401': standardErrors['401']
    }
});

route({
    method: 'post',
    path: '/users/logout',
    tags: ['Users'],
    summary: 'Invalidate the current session',
    security: [{ bearerAuth: [] }],
    responses: {
        '200': { description: 'Logged out', ...jsonContent(LogoutResponseSchema) },
        '401': standardErrors['401']
    }
});

route({
    method: 'get',
    path: '/users',
    tags: ['Users'],
    summary: 'List users in the current tenant',
    security: [{ bearerAuth: [] }],
    responses: {
        '200': { description: 'User list', ...jsonContent(z.array(MeResponseSchema.shape.profile)) },
        '401': standardErrors['401'],
        '403': standardErrors['403']
    }
});

route({
    method: 'get',
    path: '/users/{userId}',
    tags: ['Users'],
    summary: 'Fetch a single user by id',
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ userId: z.string() }) },
    responses: {
        '200': { description: 'User profile', ...jsonContent(MeResponseSchema.shape.profile) },
        '401': standardErrors['401'],
        '403': standardErrors['403'],
        '404': standardErrors['404']
    }
});

// Devices
route({
    method: 'post',
    path: '/devices/register',
    tags: ['Devices'],
    summary: 'Register the current Android device for FCM push notifications',
    security: [{ bearerAuth: [] }],
    request: {
        body: { content: { 'application/json': { schema: RegisterDeviceSchema } } }
    },
    responses: {
        '200': { description: 'Registered', ...jsonContent(DeviceRegistrationResponseSchema) },
        '400': standardErrors['400'],
        '401': standardErrors['401'],
        '403': standardErrors['403']
    }
});

route({
    method: 'post',
    path: '/devices/unregister',
    tags: ['Devices'],
    summary: 'Unregister the current Android device from FCM push notifications',
    security: [{ bearerAuth: [] }],
    request: {
        body: { content: { 'application/json': { schema: UnregisterDeviceSchema } } }
    },
    responses: {
        '200': { description: 'Unregistered', ...jsonContent(DeviceRegistrationResponseSchema) },
        '400': standardErrors['400'],
        '401': standardErrors['401'],
        '403': standardErrors['403']
    }
});

route({
    method: 'get',
    path: '/notifications',
    tags: ['Notifications'],
    summary: 'List notification history visible to the current principal',
    security: [{ bearerAuth: [] }],
    request: { query: NotificationListQuerySchema },
    responses: {
        '200': { description: 'Notification history', ...jsonContent(NotificationEventListSchema) },
        '401': standardErrors['401']
    }
});

// Master
route({
    method: 'post',
    path: '/master/login',
    tags: ['Master'],
    summary: 'Master sign-in',
    request: {
        headers: z.object({ 'X-Tenant-Slug': TenantHeaderParam }),
        body: { content: { 'application/json': { schema: MasterLoginSchema } } }
    },
    responses: {
        '200': { description: 'Authenticated', ...jsonContent(LoginResponseSchema) },
        '401': standardErrors['401'],
        '429': standardErrors['429']
    }
});

route({
    method: 'post',
    path: '/master/refresh',
    tags: ['Master'],
    summary: 'Refresh a master access token',
    request: { body: { content: { 'application/json': { schema: RefreshTokenSchema } } } },
    responses: { '200': { description: 'Refreshed', ...jsonContent(AuthEnvelopeSchema) } }
});

route({
    method: 'post',
    path: '/master/logout',
    tags: ['Master'],
    summary: 'Invalidate the master session',
    security: [{ bearerAuth: [] }],
    responses: { '200': { description: 'Logged out', ...jsonContent(LogoutResponseSchema) } }
});

route({
    method: 'post',
    path: '/master/create',
    tags: ['Master'],
    summary: 'Create another master account',
    security: [{ bearerAuth: [] }],
    request: { body: { content: { 'application/json': { schema: CreateMasterSchema } } } },
    responses: {
        '201': { description: 'Master created', ...jsonContent(LoginResponseSchema.shape.profile) },
        '401': standardErrors['401'],
        '403': standardErrors['403'],
        '409': standardErrors['409']
    }
});

// Cleaners + supervisors
route({
    method: 'get',
    path: '/cleaners',
    tags: ['Cleaners'],
    summary: 'List cleaners (optionally filtered by supervisor)',
    security: [{ bearerAuth: [] }],
    request: { query: z.object({ supervisorId: z.string().optional() }) },
    responses: { '200': { description: 'Cleaner list', ...jsonContent(CleanerListSchema) } }
});

route({
    method: 'post',
    path: '/cleaners',
    tags: ['Cleaners'],
    summary: 'Create a cleaner record',
    security: [{ bearerAuth: [] }],
    request: { body: { content: { 'application/json': { schema: CreateCleanerSchema } } } },
    responses: { '201': { description: 'Cleaner created', ...jsonContent(CleanerSchema) } }
});

route({
    method: 'patch',
    path: '/cleaners/{id}/supervisor',
    tags: ['Cleaners'],
    summary: 'Reassign a cleaner to a different supervisor',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({ id: z.string() }),
        body: { content: { 'application/json': { schema: ReassignCleanerSchema } } }
    },
    responses: { '200': { description: 'Cleaner updated', ...jsonContent(CleanerSchema) } }
});

route({
    method: 'post',
    path: '/cleaners/{id}/assign',
    tags: ['Cleaners'],
    summary: 'Assign a cleaner to a report',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({ id: z.string() }),
        body: { content: { 'application/json': { schema: AssignCleanerSchema } } }
    },
    responses: { '200': { description: 'Assignment recorded', ...jsonContent(CleanerSchema) } }
});

route({
    method: 'get',
    path: '/supervisors/{id}/cleaners',
    tags: ['Supervisors'],
    summary: 'List cleaners reporting to a supervisor',
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ id: z.string() }) },
    responses: { '200': { description: 'Cleaner list', ...jsonContent(CleanerListSchema) } }
});

// Reports
route({
    method: 'get',
    path: '/reports',
    tags: ['Reports'],
    summary: 'List reports visible to the current principal',
    security: [{ bearerAuth: [] }],
    responses: { '200': { description: 'Report list', ...jsonContent(ReportListSchema) } }
});

route({
    method: 'get',
    path: '/reports/public/status',
    tags: ['Reports'],
    summary: 'Public status board for tenant report activity',
    request: {
        headers: z.object({ 'X-Tenant-Slug': TenantHeaderParam })
    },
    responses: {
        '200': { description: 'Public status board', ...jsonContent(PublicStatusBoardSchema) },
        '400': standardErrors['400']
    }
});

route({
    method: 'get',
    path: '/reports/{id}',
    tags: ['Reports'],
    summary: 'Fetch a single report',
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ id: z.string() }) },
    responses: {
        '200': { description: 'Report', ...jsonContent(ReportSchema) },
        '404': standardErrors['404']
    }
});

route({
    method: 'post',
    path: '/reports',
    tags: ['Reports'],
    summary: 'Create a report',
    security: [{ bearerAuth: [] }],
    request: { body: { content: { 'application/json': { schema: CreateReportSchema } } } },
    responses: { '201': { description: 'Report created', ...jsonContent(ReportSchema) } }
});

route({
    method: 'put',
    path: '/reports/{id}',
    tags: ['Reports'],
    summary: 'Update a report (status, assignment, resolution)',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({ id: z.string() }),
        body: { content: { 'application/json': { schema: UpdateReportSchema } } }
    },
    responses: { '200': { description: 'Updated', ...jsonContent(ReportSchema) } }
});

route({
    method: 'get',
    path: '/reports/user/{userId}',
    tags: ['Reports'],
    summary: 'List a user\'s reports',
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ userId: z.string() }) },
    responses: { '200': { description: 'Report list', ...jsonContent(ReportListSchema) } }
});

route({
    method: 'post',
    path: '/reports/{id}/photos/presign',
    tags: ['Reports'],
    summary: 'Issue a presigned PUT URL for a report photo',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({ id: z.string() }),
        body: { content: { 'application/json': { schema: PresignPhotoSchema } } }
    },
    responses: {
        '200': { description: 'Presigned upload', ...jsonContent(PresignPhotoResponseSchema) }
    }
});

route({
    method: 'post',
    path: '/reports/{id}/photos/confirm',
    tags: ['Reports'],
    summary: 'Attach an uploaded object key to a report',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({ id: z.string() }),
        body: { content: { 'application/json': { schema: ConfirmPhotoSchema } } }
    },
    responses: { '200': { description: 'Updated report', ...jsonContent(ReportSchema) } }
});

route({
    method: 'post',
    path: '/reports/{id}/photos',
    tags: ['Reports'],
    summary: 'Legacy base64 photo upload (deprecated; use /presign + /confirm)',
    deprecated: true,
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({ id: z.string() }),
        body: { content: { 'application/json': { schema: UploadPhotoSchema } } }
    },
    responses: { '200': { description: 'Updated report', ...jsonContent(ReportSchema) } }
});

// ────────────────────────────────────────────────────────────────────────────
// Document
// ────────────────────────────────────────────────────────────────────────────

let cached: ReturnType<OpenApiGeneratorV3['generateDocument']> | null = null;

export function buildOpenApiDocument() {
    if (cached) return cached;
    const generator = new OpenApiGeneratorV3(registry.definitions);
    cached = generator.generateDocument({
        openapi: '3.0.3',
        info: {
            title: 'SpotFix Community API',
            version: '2.0.0',
            description:
                'Versioned REST API for SpotFix Community native and external clients. ' +
                'Generated from zod schemas via @asteasolutions/zod-to-openapi (P6).'
        },
        servers: [
            { url: openApiPrimaryServerUrl, description: 'Version 1 (current)' },
            { url: openApiDeprecatedServerUrl, description: 'Deprecated alias — sends Sunset header.' }
        ],
        tags: [
            { name: 'System' },
            { name: 'Users' },
            { name: 'Devices' },
            { name: 'Master' },
            { name: 'Cleaners' },
            { name: 'Supervisors' },
            { name: 'Reports' }
        ],
        security: []
    });
    return cached;
}

// Re-export so the old surface (`HealthResponseSchema` etc.) stays usable.
export { HealthResponseSchema };
