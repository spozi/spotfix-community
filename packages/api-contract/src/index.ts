/**
 * @spotfix-community/api-contract — typed SDK for the SpotFix Community API.
 *
 * The wire format is the source-of-truth OpenAPI document generated from
 * zod schemas in `apps/api/src/openapi/registry.ts`. This file restates the
 * shapes as plain TypeScript so consumers don't pull in zod or the API code.
 *
 * Keep it in sync by hand: any schema change in `apps/api/src/http/schemas.ts`
 * or `apps/api/src/openapi/schemas.ts` should be mirrored here.
 */

export type AuthRole = 'public' | 'supervisor' | 'cleaner' | 'master';
export type AuthType = 'user' | 'master';
export type PhotoKind = 'evidence' | 'resolution' | 'extra';
export type ReportStatus = 'Reported' | 'In Progress' | 'Resolved' | 'Rejected';

export interface AuthEnvelope {
    accessToken: string;
    refreshToken: string;
    tokenType: 'Bearer';
    expiresIn: string;
    refreshExpiresIn: string;
}

export interface AuthPrincipal {
    userId: string;
    role: AuthRole;
    name: string;
    authType: AuthType;
}

export interface UserProfile {
    _id: string;
    name: string;
    idNumber: string;
    phone?: string | null;
    email?: string | null;
    role: AuthRole;
    verified?: boolean;
    registeredAt?: string;
    lastLoginAt?: string | null;
    loginCount?: number;
    status?: string;
    authProvider?: 'password' | 'google';
    [key: string]: unknown;
}

export interface MeResponse {
    authenticated: true;
    auth: AuthPrincipal;
    permissions: string[];
    profile: UserProfile;
}

export interface LoginResponse extends AuthEnvelope {
    auth: AuthPrincipal;
    profile: UserProfile;
}

export interface GoogleSignInResponse extends LoginResponse {
    provider: 'google';
    isNew: boolean;
}

export interface LogoutResponse {
    success: true;
}

export interface Cleaner {
    _id: string;
    name: string;
    workId: string;
    phone?: string | null;
    supervisorId?: string | null;
    status?: string;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: unknown;
}

export interface ReportCoordinates {
    lat: number;
    lng: number;
}

export interface ReportPhotoEntry {
    url: string;
    kind?: PhotoKind;
    timestamp?: string;
    [key: string]: unknown;
}

export interface Report {
    _id: string;
    id: string;
    status: ReportStatus;
    priority?: string;
    category?: string;
    location?: string;
    details?: string;
    coordinates?: ReportCoordinates;
    reporterPhone?: string;
    reporterId?: string | null;
    assignedTo?: string | null;
    assignedToCleanerId?: string | null;
    evidencePhoto?: string | null;
    photoTimestamp?: string | null;
    resolutionPhoto?: string | null;
    resolutionTimestamp?: string | null;
    photos?: ReportPhotoEntry[];
    createdAt?: string;
    updatedAt?: string;
    [key: string]: unknown;
}

export interface PresignPhotoResponse {
    key: string;
    uploadUrl: string;
    method: 'PUT';
    headers: Record<string, string>;
    expiresIn: number;
}

export interface ErrorEnvelope {
    error: {
        code: string;
        message: string;
        details?: unknown;
        requestId?: string;
    };
}

// ────────────────────────────────────────────────────────────────────────────
// Request payloads
// ────────────────────────────────────────────────────────────────────────────

export interface RegisterPublicRequest {
    name: string;
    email: string;
    idNumber: string;
    phone: string;
    password: string;
    role?: 'public';
}

export interface ProvisionUserRequest {
    name: string;
    email?: string;
    idNumber: string;
    phone: string;
    password: string;
    role: Exclude<AuthRole, 'master'>;
}

/**
 * Sign in with either ID number or email plus password. Provide exactly one of
 * `idNumber` or `email`.
 */
export interface UserLoginRequest {
    idNumber?: string;
    email?: string;
    password: string;
}

export interface RefreshTokenRequest {
    refreshToken: string;
}

export interface MasterLoginRequest {
    username: string;
    password: string;
}

export interface CreateMasterRequest {
    username: string;
    password: string;
    name: string;
}

export interface CreateCleanerRequest {
    name: string;
    workId: string;
    phone?: string;
    supervisorId?: string;
}

export interface ReassignCleanerRequest {
    supervisorId?: string;
}

export interface AssignCleanerRequest {
    reportId: string;
    supervisorId?: string;
}

export interface CreateReportRequest {
    id: string;
    category?: string;
    location?: string;
    details?: string;
    priority?: string;
    coordinates?: ReportCoordinates;
    reporterPhone?: string;
    evidencePhoto?: string;
    photos?: unknown[];
    photoTimestamp?: string;
    [key: string]: unknown;
}

export interface UpdateReportRequest {
    status?: ReportStatus | string;
    assignedTo?: string;
    assignedToCleanerId?: string;
    resolutionPhoto?: string | null;
    resolutionTimestamp?: string;
    [key: string]: unknown;
}

export interface PresignPhotoRequest {
    kind: PhotoKind;
    contentType: string;
    contentLength?: number;
}

export interface ConfirmPhotoRequest {
    key: string;
    kind: PhotoKind;
    timestamp?: string;
}

export interface GoogleSignInRequest {
    idToken: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Client
// ────────────────────────────────────────────────────────────────────────────

export interface SpotFixClientOptions {
    /** e.g. `https://api.spotfix.example.com`. Path `/api/v1` is appended automatically. */
    baseUrl: string;
    /** Tenant slug; sent as `X-Tenant-Slug` on every request. Required for unauthenticated tenant-scoped routes. */
    tenantSlug?: string;
    /** Initial access token. Use `setAccessToken` to rotate. */
    accessToken?: string;
    /** Custom fetch (injects in environments without a global, e.g. Node 18 polyfill or test mocks). */
    fetch?: typeof fetch;
}

export class SpotFixApiError extends Error {
    readonly status: number;
    readonly code?: string;
    readonly requestId?: string;
    readonly details?: unknown;
    readonly raw?: ErrorEnvelope;

    constructor(message: string, status: number, raw?: ErrorEnvelope) {
        super(message);
        this.name = 'SpotFixApiError';
        this.status = status;
        this.code = raw?.error?.code;
        this.requestId = raw?.error?.requestId;
        this.details = raw?.error?.details;
        this.raw = raw;
    }
}

export class SpotFixClient {
    private readonly baseUrl: string;
    private readonly fetchImpl: typeof fetch;
    private accessToken?: string;
    private tenantSlug?: string;

    constructor(options: SpotFixClientOptions) {
        this.baseUrl = options.baseUrl.replace(/\/+$/, '') + '/api/v1';
        this.tenantSlug = options.tenantSlug;
        this.accessToken = options.accessToken;
        this.fetchImpl = options.fetch ?? globalThis.fetch;
        if (!this.fetchImpl) {
            throw new Error('No fetch implementation available. Pass options.fetch on Node < 18.');
        }
    }

    setAccessToken(token: string | undefined): void {
        this.accessToken = token;
    }

    setTenantSlug(slug: string | undefined): void {
        this.tenantSlug = slug;
    }

    private async request<TResponse>(
        method: string,
        path: string,
        body?: unknown,
        opts?: { skipAuth?: boolean }
    ): Promise<TResponse> {
        const headers: Record<string, string> = {
            Accept: 'application/json'
        };
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        if (this.tenantSlug) headers['X-Tenant-Slug'] = this.tenantSlug;
        if (!opts?.skipAuth && this.accessToken) {
            headers.Authorization = `Bearer ${this.accessToken}`;
        }

        const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body)
        });

        if (response.status === 204) {
            return undefined as TResponse;
        }

        const text = await response.text();
        let parsed: unknown = undefined;
        if (text.length > 0) {
            try {
                parsed = JSON.parse(text);
            } catch {
                parsed = text;
            }
        }

        if (!response.ok) {
            const envelope = parsed as ErrorEnvelope | undefined;
            const message = envelope?.error?.message ?? `HTTP ${response.status} ${response.statusText}`;
            throw new SpotFixApiError(message, response.status, envelope);
        }

        return parsed as TResponse;
    }

    // ── System ─────────────────────────────────────────────────────────────
    me(): Promise<MeResponse> {
        return this.request<MeResponse>('GET', '/me');
    }

    // ── Users ──────────────────────────────────────────────────────────────
    register(body: RegisterPublicRequest): Promise<LoginResponse> {
        return this.request<LoginResponse>('POST', '/users/register', body, { skipAuth: true });
    }

    login(body: UserLoginRequest): Promise<LoginResponse> {
        return this.request<LoginResponse>('POST', '/users/login', body, { skipAuth: true });
    }

    googleSignIn(body: GoogleSignInRequest): Promise<GoogleSignInResponse> {
        return this.request<GoogleSignInResponse>('POST', '/users/google', body, { skipAuth: true });
    }

    refresh(body: RefreshTokenRequest): Promise<AuthEnvelope> {
        return this.request<AuthEnvelope>('POST', '/users/refresh', body, { skipAuth: true });
    }

    logout(): Promise<LogoutResponse> {
        return this.request<LogoutResponse>('POST', '/users/logout');
    }

    provisionUser(body: ProvisionUserRequest): Promise<LoginResponse> {
        return this.request<LoginResponse>('POST', '/users/provision', body);
    }

    listUsers(): Promise<UserProfile[]> {
        return this.request<UserProfile[]>('GET', '/users');
    }

    getUser(userId: string): Promise<UserProfile> {
        return this.request<UserProfile>('GET', `/users/${encodeURIComponent(userId)}`);
    }

    // ── Master ─────────────────────────────────────────────────────────────
    masterLogin(body: MasterLoginRequest): Promise<LoginResponse> {
        return this.request<LoginResponse>('POST', '/master/login', body, { skipAuth: true });
    }

    masterRefresh(body: RefreshTokenRequest): Promise<AuthEnvelope> {
        return this.request<AuthEnvelope>('POST', '/master/refresh', body, { skipAuth: true });
    }

    masterLogout(): Promise<LogoutResponse> {
        return this.request<LogoutResponse>('POST', '/master/logout');
    }

    createMaster(body: CreateMasterRequest): Promise<UserProfile> {
        return this.request<UserProfile>('POST', '/master/create', body);
    }

    // ── Cleaners + supervisors ─────────────────────────────────────────────
    listCleaners(opts?: { supervisorId?: string }): Promise<Cleaner[]> {
        const qs = opts?.supervisorId
            ? `?supervisorId=${encodeURIComponent(opts.supervisorId)}`
            : '';
        return this.request<Cleaner[]>('GET', `/cleaners${qs}`);
    }

    createCleaner(body: CreateCleanerRequest): Promise<Cleaner> {
        return this.request<Cleaner>('POST', '/cleaners', body);
    }

    reassignCleaner(id: string, body: ReassignCleanerRequest): Promise<Cleaner> {
        return this.request<Cleaner>('PATCH', `/cleaners/${encodeURIComponent(id)}/supervisor`, body);
    }

    assignCleanerToReport(cleanerId: string, body: AssignCleanerRequest): Promise<Report> {
        return this.request<Report>('POST', `/cleaners/${encodeURIComponent(cleanerId)}/assign`, body);
    }

    listSupervisorCleaners(supervisorId: string): Promise<Cleaner[]> {
        return this.request<Cleaner[]>('GET', `/supervisors/${encodeURIComponent(supervisorId)}/cleaners`);
    }

    // ── Reports ────────────────────────────────────────────────────────────
    listReports(): Promise<Report[]> {
        return this.request<Report[]>('GET', '/reports');
    }

    getReport(id: string): Promise<Report> {
        return this.request<Report>('GET', `/reports/${encodeURIComponent(id)}`);
    }

    listUserReports(userId: string): Promise<Report[]> {
        return this.request<Report[]>('GET', `/reports/user/${encodeURIComponent(userId)}`);
    }

    createReport(body: CreateReportRequest): Promise<Report> {
        return this.request<Report>('POST', '/reports', body);
    }

    updateReport(id: string, body: UpdateReportRequest): Promise<Report> {
        return this.request<Report>('PUT', `/reports/${encodeURIComponent(id)}`, body);
    }

    presignReportPhoto(reportId: string, body: PresignPhotoRequest): Promise<PresignPhotoResponse> {
        return this.request<PresignPhotoResponse>(
            'POST',
            `/reports/${encodeURIComponent(reportId)}/photos/presign`,
            body
        );
    }

    confirmReportPhoto(reportId: string, body: ConfirmPhotoRequest): Promise<Report> {
        return this.request<Report>(
            'POST',
            `/reports/${encodeURIComponent(reportId)}/photos/confirm`,
            body
        );
    }

    /**
     * High-level helper: presign → PUT → confirm. The PUT goes directly to
     * the bucket without auth; the confirm call attaches the key.
     */
    async uploadReportPhoto(
        reportId: string,
        kind: PhotoKind,
        body: BodyInit & { byteLength?: number },
        contentType: string
    ): Promise<Report> {
        const contentLength = (body as { byteLength?: number }).byteLength;
        const presigned = await this.presignReportPhoto(reportId, {
            kind,
            contentType,
            contentLength
        });

        const putResponse = await this.fetchImpl(presigned.uploadUrl, {
            method: presigned.method,
            headers: presigned.headers,
            body
        });
        if (!putResponse.ok) {
            throw new SpotFixApiError(
                `Photo upload failed: HTTP ${putResponse.status}`,
                putResponse.status
            );
        }

        return this.confirmReportPhoto(reportId, {
            key: presigned.key,
            kind,
            timestamp: new Date().toISOString()
        });
    }
}
