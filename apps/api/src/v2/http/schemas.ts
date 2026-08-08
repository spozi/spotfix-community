import { z } from 'zod';

const platform = z.enum(['android']);

export const RegisterDeviceV2Schema = z.object({
    platform: platform.default('android'),
    device_name: z.string().min(1).max(120).optional(),
    device_fingerprint: z.string().min(8).max(256),
    fcm_token: z.string().min(1).max(512).optional(),
    app_version: z.string().min(1).max(40).optional(),
    os_version: z.string().min(1).max(80).optional()
});

export const LoginV2Schema = z.object({
    device_id: z.string().min(1),
    email: z.string().trim().email(),
    password: z.string().min(1)
});

export const RefreshV2Schema = z.object({
    device_id: z.string().min(1),
    refresh_token: z.string().min(1)
});

export const LogoutDeviceV2Schema = z.object({
    device_id: z.string().min(1)
});

export const GoogleLoginV2Schema = z.object({
    device_id: z.string().min(1),
    id_token: z.string().min(1)
});

export const AdminListUsersQuerySchema = z.object({
    search: z.string().trim().min(1).max(120).optional(),
    limit: z.coerce.number().int().positive().max(200).optional()
});

export const AdminAssignRoleSchema = z.object({
    role: z.enum(['supervisor', 'cleaner'])
});

// ---- Stage 2: reports / workflow ----------------------------------------

const attachmentTypeEnum = z.enum([
    'report_evidence',
    'cleaner_resolution_evidence',
    'supervisor_review_evidence'
]);

const AttachmentInputSchema = z.object({
    file_url: z.string().min(1).max(2048),
    attachment_type: attachmentTypeEnum,
    file_mime_type: z.string().min(1).max(120).optional(),
    file_size: z.number().int().nonnegative().max(50_000_000).optional()
});

export const CreateReportV2Schema = z.object({
    title: z.string().trim().min(3).max(200),
    description: z.string().max(4000).optional(),
    location_lat: z.number().min(-90).max(90).optional(),
    location_lng: z.number().min(-180).max(180).optional(),
    location_address: z.string().max(400).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    attachments: z.array(AttachmentInputSchema).max(10).optional()
});

export const SupervisorListQuerySchema = z.object({
    status: z
        .enum([
            'submitted',
            'assigned',
            'accepted_by_cleaner',
            'in_progress',
            'resolved_by_cleaner',
            'endorsed_by_supervisor',
            'rejected_by_cleaner',
            'rejected_by_supervisor',
            'closed',
            'cancelled'
        ])
        .optional(),
    page: z.coerce.number().int().positive().max(1000).optional(),
    limit: z.coerce.number().int().positive().max(100).optional()
});

export const AssignCleanerSchema = z.object({
    cleaner_user_id: z.string().min(1),
    expected_completion_at: z.string().datetime({ offset: true }).optional(),
    note: z.string().max(500).optional()
});

export const EndorseSchema = z.object({
    note: z.string().max(500).optional()
});

export const RejectSchema = z.object({
    reason: z.string().trim().min(3).max(500)
});

export const ResolveTaskSchema = z.object({
    note: z.string().max(500).optional(),
    attachments: z.array(AttachmentInputSchema).max(10).optional()
});

export const SyncQuerySchema = z.object({
    since: z.coerce.number().int().nonnegative().optional(),
    limit: z.coerce.number().int().positive().max(500).optional(),
    report_id: z.string().min(1).optional()
});

export const PageQuerySchema = z.object({
    page: z.coerce.number().int().positive().max(10_000).optional(),
    limit: z.coerce.number().int().positive().max(100).optional()
});

export const NotificationsQuerySchema = z.object({
    unread_only: z.coerce.boolean().optional(),
    limit: z.coerce.number().int().positive().max(200).optional()
});

export const PresignUploadV2Schema = z.object({
    report_id: z.string().min(1),
    kind: z.enum(['evidence', 'resolution', 'extra']).default('evidence'),
    content_type: z.string().min(1).max(120),
    content_length: z.number().int().positive().max(50_000_000).optional()
});

// ---- Geo ------------------------------------------------------------------

export const GeoResolveQuerySchema = z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180)
});

// ---- Monitor (public dashboard) --------------------------------------------

export const MonitorReportsQuerySchema = z.object({
    status: z
        .enum([
            'submitted',
            'assigned',
            'accepted_by_cleaner',
            'in_progress',
            'resolved_by_cleaner',
            'endorsed_by_supervisor',
            'rejected_by_cleaner',
            'rejected_by_supervisor',
            'closed',
            'cancelled'
        ])
        .optional(),
    limit: z.coerce.number().int().positive().max(500).optional()
});
