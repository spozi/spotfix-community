/**
 * Serializers for v2 report payloads. Convert internal Prisma rows into the
 * snake_case JSON shape that android_v2_api_v2.md §10–§13 specifies.
 */
import type { NotificationV2, ReportAttachmentV2, ReportEventV2, ReportV2 } from '@prisma/client';

export function serializeReport(r: ReportV2) {
    return {
        id: r.id,
        title: r.title,
        description: r.description,
        status: r.status,
        priority: r.priority,
        reporter_user_id: r.reporterUserId,
        assigned_supervisor_id: r.assignedSupervisorId,
        assigned_cleaner_id: r.assignedCleanerId,
        location_lat: r.locationLat,
        location_lng: r.locationLng,
        location_address: r.locationAddress,
        version: r.version,
        created_at: r.createdAt.toISOString(),
        updated_at: r.updatedAt.toISOString()
    };
}

export function serializeReportSummary(r: ReportV2) {
    return {
        id: r.id,
        title: r.title,
        status: r.status,
        location_address: r.locationAddress,
        version: r.version,
        updated_at: r.updatedAt.toISOString()
    };
}

export function serializeAttachment(a: ReportAttachmentV2, fileUrl: string = a.fileUrl) {
    return {
        id: a.id,
        attachment_type: a.attachmentType,
        file_url: fileUrl,
        file_mime_type: a.fileMimeType,
        file_size: a.fileSize,
        uploaded_by_user_id: a.uploadedByUserId,
        created_at: a.createdAt.toISOString()
    };
}

export function serializeEvent(e: ReportEventV2) {
    return {
        id: e.id,
        seq: e.seq,
        report_id: e.reportId,
        event_type: e.eventType,
        actor_user_id: e.actorUserId,
        actor_role: e.actorRole,
        payload: e.payload,
        created_at: e.createdAt.toISOString()
    };
}

export function serializeNotification(n: NotificationV2) {
    return {
        id: n.id,
        report_id: n.reportId,
        event_id: n.eventId,
        title: n.title,
        body: n.body,
        is_read: n.isRead,
        created_at: n.createdAt.toISOString(),
        read_at: n.readAt ? n.readAt.toISOString() : null
    };
}

export function mutationEnvelope(args: {
    report: ReportV2;
    event: ReportEventV2;
    cursor: number;
}) {
    return {
        report: serializeReport(args.report),
        event: { id: args.event.id, type: args.event.eventType },
        sync: { cursor: args.cursor }
    };
}
