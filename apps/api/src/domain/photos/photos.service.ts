/**
 * src/domain/photos/photos.service.ts
 *
 * Centralizes how photos move between API requests, Postgres rows, and the
 * S3-compatible object store. Two ingestion modes:
 *
 *  1. Legacy base64 — request bodies that carry `data:image/...;base64,...`
 *     strings. The service decodes, uploads to MinIO/S3, and returns the
 *     storage key. Keeps backward compatibility with the iOS client built
 *     before P3.
 *
 *  2. Direct upload — clients call `presignUploadUrl` to get a short-lived
 *     PUT URL, upload the binary directly to MinIO/S3, then attach the
 *     resulting key to a report via the confirm endpoint.
 *
 * Outbound serialization always converts stored keys back to short-lived
 * presigned GET URLs so clients can render the photo without holding any
 * S3 credentials.
 */
import crypto from 'node:crypto';

import { env } from '../../config/env';
import { ValidationError } from '../../errors';
import {
    buildPhotoKey,
    isStorageKey,
    presignGet,
    presignPut,
    putBytes,
    type PresignPutResult
} from '../../infra/storage';

const DATA_URL_REGEX = /^data:([^;,]+);base64,(.+)$/;

const ALLOWED_MIME = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
]);

function extensionFor(mime: string): string {
    switch (mime) {
        case 'image/jpeg':
        case 'image/jpg':
            return 'jpg';
        case 'image/png':
            return 'png';
        case 'image/webp':
            return 'webp';
        case 'image/heic':
            return 'heic';
        case 'image/heif':
            return 'heif';
        default:
            return 'bin';
    }
}

interface DecodedDataUrl {
    contentType: string;
    bytes: Buffer;
}

function decodeDataUrl(dataUrl: string): DecodedDataUrl | null {
    const m = DATA_URL_REGEX.exec(dataUrl);
    if (!m) return null;
    const [, rawContentType = '', rawBase64 = ''] = m;
    if (!rawContentType || !rawBase64) return null;
    const contentType = rawContentType.toLowerCase();
    let bytes: Buffer;
    try {
        bytes = Buffer.from(rawBase64, 'base64');
    } catch {
        return null;
    }
    if (bytes.length === 0) return null;
    return { contentType, bytes };
}

export const photosService = {
    /**
     * Accept either an existing storage key (passed through), an http(s) URL
     * (passed through; assumes pre-existing), or a `data:` URL which gets
     * decoded and uploaded to object storage. Returns the canonical storage
     * key (or the original value for non-data inputs).
     */
    async ingestPhotoString(
        value: string | null | undefined,
        opts: { reportId: string; kind: 'evidence' | 'resolution' | 'extra' }
    ): Promise<string | null> {
        if (!value) return null;
        if (isStorageKey(value) || /^https?:\/\//i.test(value)) return value;
        if (!value.startsWith('data:')) return value;

        const decoded = decodeDataUrl(value);
        if (!decoded) {
            throw new ValidationError('Invalid data URL for photo upload');
        }
        if (!ALLOWED_MIME.has(decoded.contentType)) {
            throw new ValidationError(`Unsupported image type: ${decoded.contentType}`);
        }
        if (decoded.bytes.length > env.STORAGE_MAX_UPLOAD_BYTES) {
            throw new ValidationError('Photo exceeds the maximum upload size');
        }

        const fileName = `${crypto.randomUUID()}.${extensionFor(decoded.contentType)}`;
        const key = buildPhotoKey({ reportId: opts.reportId, kind: opts.kind, fileName });
        await putBytes({ key, body: decoded.bytes, contentType: decoded.contentType });
        return key;
    },

    async ingestPhotoArray(
        items: unknown,
        opts: { reportId: string; kind: 'evidence' | 'resolution' | 'extra' }
    ): Promise<unknown[]> {
        if (!Array.isArray(items)) return [];
        const out: unknown[] = [];
        for (const item of items) {
            if (typeof item === 'string') {
                const ingested = await photosService.ingestPhotoString(item, opts);
                if (ingested) out.push(ingested);
                continue;
            }
            if (item && typeof item === 'object') {
                const dataUrl = (item as { dataUrl?: unknown }).dataUrl;
                if (typeof dataUrl === 'string') {
                    const ingested = await photosService.ingestPhotoString(dataUrl, opts);
                    if (ingested) out.push(ingested);
                    continue;
                }
                const key = (item as { key?: unknown }).key;
                if (typeof key === 'string' && isStorageKey(key)) {
                    out.push(key);
                    continue;
                }
            }
        }
        return out;
    },

    /**
     * Convert a stored value (key, data URL, or absolute URL) into something
     * a client can render. Storage keys become short-lived presigned GET URLs.
     */
    async resolvePhotoString(value: string | null | undefined): Promise<string | null> {
        if (!value) return null;
        if (isStorageKey(value)) return presignGet(value);
        return value;
    },

    async resolvePhotoArray(items: unknown): Promise<string[]> {
        if (!Array.isArray(items)) return [];
        const out: string[] = [];
        for (const item of items) {
            if (typeof item === 'string') {
                const resolved = await photosService.resolvePhotoString(item);
                if (resolved) out.push(resolved);
            } else if (item && typeof item === 'object') {
                const v = (item as { key?: unknown; url?: unknown; dataUrl?: unknown });
                const candidate =
                    typeof v.key === 'string' ? v.key
                    : typeof v.url === 'string' ? v.url
                    : typeof v.dataUrl === 'string' ? v.dataUrl
                    : null;
                if (candidate) {
                    const resolved = await photosService.resolvePhotoString(candidate);
                    if (resolved) out.push(resolved);
                }
            }
        }
        return out;
    },

    /**
     * Issue a presigned PUT URL for direct client upload. Returns the key the
     * client should later POST to /photos/confirm.
     */
    async presignUploadUrl(opts: {
        reportId: string;
        kind: 'evidence' | 'resolution' | 'extra';
        contentType: string;
        contentLength?: number;
    }): Promise<PresignPutResult> {
        const contentType = opts.contentType.toLowerCase();
        if (!ALLOWED_MIME.has(contentType)) {
            throw new ValidationError(`Unsupported image type: ${contentType}`);
        }
        if (opts.contentLength !== undefined && opts.contentLength > env.STORAGE_MAX_UPLOAD_BYTES) {
            throw new ValidationError('Photo exceeds the maximum upload size');
        }
        const fileName = `${crypto.randomUUID()}.${extensionFor(contentType)}`;
        const key = buildPhotoKey({ reportId: opts.reportId, kind: opts.kind, fileName });
        return presignPut({ key, contentType, contentLength: opts.contentLength });
    }
};
