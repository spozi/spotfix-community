/**
 * src/infra/storage.ts
 *
 * S3-compatible object storage abstraction. Works against MinIO locally and
 * OCI Object Storage / AWS S3 in production. All operations are tenant-scoped
 * by key prefix; no header-based isolation is required because keys are built
 * from the active tenant id pulled from `tenant-context`.
 */
import { Readable } from 'node:stream';

import {
    DeleteObjectCommand,
    GetObjectCommand,
    PutObjectCommand,
    S3Client
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { env } from '../config/env';
import { logger } from '../config/logger';
import { currentTenantId } from './tenant-context';

const forcePathStyle = env.STORAGE_FORCE_PATH_STYLE === 'true';

export const s3 = new S3Client({
    endpoint: env.STORAGE_ENDPOINT,
    region: env.STORAGE_REGION,
    forcePathStyle,
    credentials: {
        accessKeyId: env.STORAGE_ACCESS_KEY,
        secretAccessKey: env.STORAGE_SECRET_KEY
    }
});

// Use a dedicated signer endpoint for URLs returned to clients.
// Important: host is part of SigV4 canonical request. Rewriting the host
// after signing will invalidate the signature.
const presignEndpoint = env.STORAGE_PUBLIC_BASE_URL || env.STORAGE_ENDPOINT;
const s3Presign = new S3Client({
    endpoint: presignEndpoint,
    region: env.STORAGE_REGION,
    forcePathStyle,
    credentials: {
        accessKeyId: env.STORAGE_ACCESS_KEY,
        secretAccessKey: env.STORAGE_SECRET_KEY
    }
});

export const STORAGE_BUCKET = env.STORAGE_BUCKET;

/** Build a tenant-scoped object key. Throws if no tenant context active. */
export function buildPhotoKey(opts: {
    reportId: string;
    kind: 'evidence' | 'resolution' | 'extra';
    fileName: string;
}): string {
    const tenantId = currentTenantId();
    if (!tenantId) {
        throw new Error('Cannot build photo key without tenant context');
    }
    const safeName = opts.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `tenants/${tenantId}/reports/${opts.reportId}/${opts.kind}/${safeName}`;
}

/** True if the stored value is an object key (not a data URL or http URL). */
export function isStorageKey(value: string | null | undefined): boolean {
    if (!value) return false;
    if (value.startsWith('data:')) return false;
    if (/^https?:\/\//i.test(value)) return false;
    return value.startsWith('tenants/');
}

export async function putBytes(opts: {
    key: string;
    body: Buffer;
    contentType: string;
}): Promise<void> {
    await s3.send(
        new PutObjectCommand({
            Bucket: STORAGE_BUCKET,
            Key: opts.key,
            Body: opts.body,
            ContentType: opts.contentType
        })
    );
}

export async function deleteObject(key: string): Promise<void> {
    try {
        await s3.send(new DeleteObjectCommand({ Bucket: STORAGE_BUCKET, Key: key }));
    } catch (err) {
        logger.warn({ err, key }, 'storage: delete failed');
    }
}

export async function presignGet(key: string, ttlSeconds = env.STORAGE_PRESIGN_GET_TTL): Promise<string> {
    return getSignedUrl(
        s3Presign,
        new GetObjectCommand({ Bucket: STORAGE_BUCKET, Key: key }),
        { expiresIn: ttlSeconds }
    );
}

export interface PresignPutResult {
    key: string;
    uploadUrl: string;
    method: 'PUT';
    headers: Record<string, string>;
    expiresIn: number;
}

export async function presignPut(opts: {
    key: string;
    contentType: string;
    contentLength?: number;
}): Promise<PresignPutResult> {
    const cmd = new PutObjectCommand({
        Bucket: STORAGE_BUCKET,
        Key: opts.key,
        ContentType: opts.contentType,
        ContentLength: opts.contentLength
    });
    const ttl = env.STORAGE_PRESIGN_PUT_TTL;
    const uploadUrl = await getSignedUrl(s3Presign, cmd, { expiresIn: ttl });
    const headers: Record<string, string> = { 'Content-Type': opts.contentType };
    if (opts.contentLength !== undefined) {
        headers['Content-Length'] = String(opts.contentLength);
    }
    return { key: opts.key, uploadUrl, method: 'PUT', headers, expiresIn: ttl };
}

/** Drain a readable stream into a Buffer. */
export async function streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
    }
    return Buffer.concat(chunks);
}
