/**
 * Response (and a few extra request) zod schemas. Kept in their own module
 * so request schemas in http/schemas.ts stay narrowly focused on validation.
 *
 * Importing this file ensures `extendZodWithOpenApi` has run, so `.openapi()`
 * chains are available on every schema below.
 */
import { z } from './zod';

const isoDateTime = z.string().describe('ISO-8601 timestamp');
const cuidLike = z.string().describe('Server-generated identifier (cuid).');

// ────────────────────────────────────────────────────────────────────────────
// Auth / principal
// ────────────────────────────────────────────────────────────────────────────

export const AuthRoleSchema = z
    .enum(['public', 'supervisor', 'cleaner', 'master'])
    .openapi('AuthRole');

export const AuthTypeSchema = z.enum(['user', 'master']).openapi('AuthType');

export const AuthEnvelopeSchema = z
    .object({
        accessToken: z.string(),
        refreshToken: z.string(),
        tokenType: z.literal('Bearer'),
        expiresIn: z.string().describe('Lifetime of the access token (e.g. "15m").'),
        refreshExpiresIn: z.string().describe('Lifetime of the refresh token (e.g. "30d").')
    })
    .openapi('AuthEnvelope');

export const AuthPrincipalSchema = z
    .object({
        userId: z.string(),
        role: AuthRoleSchema,
        name: z.string(),
        authType: AuthTypeSchema
    })
    .openapi('AuthPrincipal');

export const UserProfileSchema = z
    .object({
        _id: cuidLike,
        name: z.string(),
        idNumber: z.string(),
        phone: z.string().nullable().optional(),
        workLocation: z.string().nullable().optional(),
        email: z.string().email().nullable().optional(),
        role: AuthRoleSchema,
        verified: z.boolean().optional(),
        registeredAt: isoDateTime.optional(),
        lastLoginAt: isoDateTime.nullable().optional(),
        loginCount: z.number().int().nonnegative().optional(),
        status: z.string().optional()
    })
    .passthrough()
    .openapi('UserProfile');

export const MeResponseSchema = z
    .object({
        authenticated: z.literal(true),
        auth: AuthPrincipalSchema,
        permissions: z.array(z.string()),
        profile: UserProfileSchema
    })
    .openapi('MeResponse');

export const LoginResponseSchema = AuthEnvelopeSchema.extend({
    auth: AuthPrincipalSchema,
    profile: UserProfileSchema
}).openapi('LoginResponse');

export const GoogleSignInResponseSchema = LoginResponseSchema.extend({
    provider: z.literal('google'),
    isNew: z.boolean()
}).openapi('GoogleSignInResponse');

export const LogoutResponseSchema = z
    .object({ success: z.literal(true) })
    .openapi('LogoutResponse');

export const DeviceRegistrationResponseSchema = z
    .object({ success: z.literal(true) })
    .openapi('DeviceRegistrationResponse');

// ────────────────────────────────────────────────────────────────────────────
// Cleaners / supervisors
// ────────────────────────────────────────────────────────────────────────────

export const CleanerSchema = z
    .object({
        _id: cuidLike,
        name: z.string(),
        workId: z.string(),
        phone: z.string().nullable().optional(),
        workLocation: z.string().nullable().optional(),
        supervisorId: z.string().nullable().optional(),
        supervisorName: z.string().nullable().optional(),
        isBusy: z.boolean().optional(),
        assignedTaskId: z.string().nullable().optional(),
        busyUntil: isoDateTime.nullable().optional(),
        status: z.enum(['Busy', 'Free']).optional(),
        timeLeft: z.number().nonnegative().optional(),
        createdAt: isoDateTime.optional(),
        updatedAt: isoDateTime.optional()
    })
    .passthrough()
    .openapi('Cleaner');

export const CleanerListSchema = z.array(CleanerSchema).openapi('CleanerList');

export const NotificationEventSchema = z
    .object({
        _id: cuidLike,
        reportId: z.string().optional(),
        type: z.string(),
        title: z.string(),
        body: z.string(),
        isCritical: z.boolean(),
        payload: z.record(z.string(), z.unknown()),
        createdAt: isoDateTime
    })
    .openapi('NotificationEvent');

export const NotificationEventListSchema = z.array(NotificationEventSchema).openapi('NotificationEventList');

// ────────────────────────────────────────────────────────────────────────────
// Reports
// ────────────────────────────────────────────────────────────────────────────

export const ReportStatusSchema = z
    .enum(['Reported', 'Assigned', 'In Progress', 'Awaiting Endorsement', 'Resolved', 'Rejected'])
    .openapi('ReportStatus');

export const ReportCoordinatesSchema = z
    .object({
        lat: z.number(),
        lng: z.number()
    })
    .openapi('ReportCoordinates');

export const ReportPhotoEntrySchema = z
    .object({
        url: z.string().describe('Presigned GET URL or legacy data: URL.'),
        kind: z.enum(['evidence', 'resolution', 'extra']).optional(),
        timestamp: isoDateTime.optional()
    })
    .passthrough()
    .openapi('ReportPhotoEntry');

export const ReportSchema = z
    .object({
        _id: cuidLike,
        id: z.string().describe('Public server-generated report identifier (e.g. "RPT-100000").'),
        status: ReportStatusSchema,
        timestamp: isoDateTime,
        priority: z.string().optional(),
        category: z.string().optional(),
        location: z.string().optional(),
        details: z.string().optional(),
        coordinates: ReportCoordinatesSchema.optional(),
        reporterPhone: z.string().optional(),
        userId: z.string(),
        userName: z.string().optional(),
        reporterName: z.string().optional(),
        reporterId: z.string().nullable().optional(),
        assignedTo: z.string().nullable().optional(),
        assignedToCleanerId: z.string().nullable().optional(),
        assignedBySupervisorId: z.string().nullable().optional(),
        assignedBySupervisorName: z.string().nullable().optional(),
        evidencePhoto: z.string().nullable().optional()
            .describe('Presigned GET URL when photo present, else null.'),
        photoTimestamp: isoDateTime.nullable().optional(),
        resolutionPhoto: z.string().nullable().optional(),
        resolutionTimestamp: isoDateTime.nullable().optional(),
        resolutionCoordinates: ReportCoordinatesSchema.optional(),
        resolutionDistanceMeters: z.number().nullable().optional(),
        reviewedAt: isoDateTime.nullable().optional(),
        reviewedBySupervisorId: z.string().nullable().optional(),
        reviewedBySupervisorName: z.string().nullable().optional(),
        reviewNotes: z.string().nullable().optional(),
        photos: z.array(ReportPhotoEntrySchema).optional(),
        createdAt: isoDateTime.optional(),
        updatedAt: isoDateTime.optional()
    })
    .passthrough()
    .openapi('Report');

export const ReportListSchema = z.array(ReportSchema).openapi('ReportList');

export const PublicStatusReportSchema = z
    .object({
        _id: cuidLike,
        id: z.string(),
        status: ReportStatusSchema,
        priority: z.string(),
        category: z.string().optional(),
        location: z.string().optional(),
        details: z.string().optional(),
        assignedTo: z.string().optional(),
        timestamp: isoDateTime,
        resolutionTimestamp: isoDateTime.optional()
    })
    .openapi('PublicStatusReport');

export const PublicStatusCleanerSchema = z
    .object({
        _id: cuidLike,
        name: z.string(),
        workLocation: z.string().optional(),
        status: z.enum(['Busy', 'Free']),
        assignedTaskId: z.string().optional()
    })
    .openapi('PublicStatusCleaner');

export const PublicStatusSummarySchema = z
    .object({
        total: z.number().int().nonnegative(),
        open: z.number().int().nonnegative(),
        pending: z.number().int().nonnegative(),
        resolved: z.number().int().nonnegative(),
        urgent: z.number().int().nonnegative(),
        cleaners: z.number().int().nonnegative(),
        availableCleaners: z.number().int().nonnegative(),
        busyCleaners: z.number().int().nonnegative()
    })
    .openapi('PublicStatusSummary');

export const PublicStatusBoardSchema = z
    .object({
        generatedAt: isoDateTime,
        summary: PublicStatusSummarySchema,
        reports: z.array(PublicStatusReportSchema),
        cleaners: z.array(PublicStatusCleanerSchema)
    })
    .openapi('PublicStatusBoard');

// ────────────────────────────────────────────────────────────────────────────
// Photo upload
// ────────────────────────────────────────────────────────────────────────────

export const PresignPhotoResponseSchema = z
    .object({
        key: z.string().describe('Object-storage key. Pass back to /photos/confirm.'),
        uploadUrl: z.string().url(),
        method: z.literal('PUT'),
        headers: z.record(z.string(), z.string()),
        expiresIn: z.number().int().positive().describe('Seconds until uploadUrl expires.')
    })
    .openapi('PresignPhotoResponse');

// ────────────────────────────────────────────────────────────────────────────
// Errors / system
// ────────────────────────────────────────────────────────────────────────────

export const ErrorEnvelopeSchema = z
    .object({
        error: z.object({
            code: z.string(),
            message: z.string(),
            details: z.unknown().optional(),
            requestId: z.string().optional()
        })
    })
    .openapi('ErrorEnvelope');

export const ApiInfoSchema = z
    .object({
        name: z.string(),
        version: z.string(),
        environment: z.string().optional()
    })
    .passthrough()
    .openapi('ApiInfo');

export const HealthResponseSchema = z
    .object({
        status: z.literal('ok'),
        timestamp: isoDateTime
    })
    .openapi('HealthResponse');
