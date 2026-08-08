import { z } from '../openapi/zod';

const password = z.string().min(6, 'Password must be at least 6 characters');
const idNumber = z.string().min(1, 'ID number is required');
const phone = z.string().min(1).optional();
const email = z.string().trim().email('Valid email is required');
const userRole = z.enum(['public', 'supervisor', 'cleaner']);
const devicePlatform = z.enum(['android']);

export const RegisterPublicSchema = z.object({
    name: z.string().min(1),
    email,
    idNumber,
    phone: z.string().min(1, 'phone is required'),
    password,
    role: z.literal('public').optional()
});

export const ProvisionUserSchema = z.object({
    name: z.string().min(1),
    email: email.optional(),
    idNumber,
    phone: z.string().min(1),
    workLocation: z.string().min(1).optional(),
    password,
    role: userRole
});

export const UserLoginSchema = z
    .object({
        idNumber: idNumber.optional(),
        email: email.optional(),
        password: z.string().min(1)
    })
    .refine((value) => Boolean(value.idNumber) || Boolean(value.email), {
        message: 'Provide email or ID number to sign in.',
        path: ['email']
    });

export const RefreshTokenSchema = z.object({
    refreshToken: z.string().min(1)
});

export const UserIdParamSchema = z.object({
    userId: z.string().min(1)
});

export const RegisterDeviceSchema = z.object({
    token: z.string().min(1),
    platform: devicePlatform.default('android'),
    appVersion: z.string().min(1).optional(),
    deviceId: z.string().min(1).optional(),
    deviceName: z.string().min(1).optional(),
    notificationsEnabled: z.boolean().optional()
});

export const UnregisterDeviceSchema = z.object({
    token: z.string().min(1)
});

export const MasterLoginSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1)
});

export const CreateMasterSchema = z.object({
    username: z.string().min(1),
    password,
    name: z.string().min(1)
});

export const CreateCleanerSchema = z.object({
    name: z.string().min(1),
    workId: z.string().min(1),
    phone,
    workLocation: z.string().min(1).optional(),
    supervisorId: z.string().optional()
});

export const ReassignCleanerSchema = z.object({
    supervisorId: z.string().optional()
});

export const AssignCleanerSchema = z.object({
    reportId: z.string().min(1),
    supervisorId: z.string().optional()
});

export const CleanerIdParamSchema = z.object({ id: z.string().min(1) });

export const CleanerListQuerySchema = z.object({
    supervisorId: z.string().optional(),
    workLocation: z.string().optional()
});

export const NotificationListQuerySchema = z.object({
    limit: z.coerce.number().int().positive().max(100).optional()
});

export const SupervisorIdParamSchema = z.object({ id: z.string().min(1) });

export const ReportIdParamSchema = z.object({ id: z.string().min(1) });

// Reports payload is largely free-form (mobile clients post heterogeneous
// metadata + photo data URLs). We validate only the few fields the API
// actually relies on; the rest is passed through to the model.
export const CreateReportSchema = z.object({
    id: z.string().min(1).optional(),
    category: z.string().optional(),
    location: z.string().optional(),
    details: z.string().optional(),
    priority: z.string().optional(),
    coordinates: z.unknown().optional(),
    reporterPhone: z.string().optional(),
    evidencePhoto: z.string().optional(),
    photos: z.array(z.unknown()).optional(),
    photoTimestamp: z.string().optional()
}).passthrough();

export const UpdateReportSchema = z.object({
    status: z.string().optional(),
    assignedTo: z.string().optional(),
    assignedToCleanerId: z.string().optional(),
    resolutionPhoto: z.string().optional(),
    resolutionTimestamp: z.string().optional(),
    resolutionCoordinates: z.object({
        lat: z.number(),
        lng: z.number()
    }).optional(),
    reviewNotes: z.string().optional()
}).passthrough();

const PhotoKindSchema = z.enum(['evidence', 'resolution', 'extra']);

export const PresignPhotoSchema = z.object({
    kind: PhotoKindSchema,
    contentType: z.string().min(1),
    contentLength: z.number().int().positive().optional()
});

export const ConfirmPhotoSchema = z.object({
    key: z.string().min(1),
    kind: PhotoKindSchema,
    timestamp: z.string().optional()
});

export const UploadPhotoSchema = z.object({
    kind: PhotoKindSchema,
    dataUrl: z.string().min(1),
    timestamp: z.string().optional()
});

export const GoogleSignInSchema = z.object({
    idToken: z.string().min(1, 'idToken is required')
});

export type RegisterPublicInput = z.infer<typeof RegisterPublicSchema>;
export type ProvisionUserInput = z.infer<typeof ProvisionUserSchema>;
export type UserLoginInput = z.infer<typeof UserLoginSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;
export type RegisterDeviceInput = z.infer<typeof RegisterDeviceSchema>;
export type UnregisterDeviceInput = z.infer<typeof UnregisterDeviceSchema>;
export type MasterLoginInput = z.infer<typeof MasterLoginSchema>;
export type CreateMasterInput = z.infer<typeof CreateMasterSchema>;
export type CreateCleanerInput = z.infer<typeof CreateCleanerSchema>;
export type ReassignCleanerInput = z.infer<typeof ReassignCleanerSchema>;
export type AssignCleanerInput = z.infer<typeof AssignCleanerSchema>;
export type NotificationListQueryInput = z.infer<typeof NotificationListQuerySchema>;
export type CreateReportInput = z.infer<typeof CreateReportSchema>;
export type UpdateReportInput = z.infer<typeof UpdateReportSchema>;
