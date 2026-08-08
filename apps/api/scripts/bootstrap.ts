/**
 * scripts/bootstrap.ts
 *
 * Creates the initial tenant + first master user when standing up a brand-new
 * environment. Idempotent: re-running with the same slug + username is a no-op.
 *
 * Usage (env-driven):
 *   BOOTSTRAP_TENANT_SLUG=example-campus \
 *   BOOTSTRAP_TENANT_NAME="Example Facilities" \
 *   BOOTSTRAP_MASTER_USERNAME=admin \
 *   BOOTSTRAP_MASTER_PASSWORD='<strong-password>' \
 *   BOOTSTRAP_MASTER_NAME="Master Admin" \
 *   npm run bootstrap
 */
import bcrypt from 'bcryptjs';
import { existsSync, readFileSync } from 'node:fs';

import { prismaRaw } from '../src/infra/prisma';

function required(name: string): string {
    const v = process.env[name];
    if (!v || v.trim() === '') {
        throw new Error(`Missing required env: ${name}`);
    }
    return v.trim();
}

function optional(name: string): string | undefined {
    const v = process.env[name];
    if (!v || v.trim() === '') return undefined;
    return v.trim();
}

function flag(name: string): boolean {
    const value = optional(name);
    if (!value) return false;
    return ['1', 'true', 'yes', 'y', 'on'].includes(value.toLowerCase());
}

interface CsvRow {
    lineNo: number;
    row: Record<string, string>;
}

interface DuplicateEntry {
    key: string;
    lines: number[];
}

interface DuplicateReport {
    groups: number;
    entries: DuplicateEntry[];
}

interface StaffSeedSummary {
    skipped: boolean;
    reason?: string;
    csv: {
        supervisors: number;
        cleaners: number;
    };
    duplicates: {
        supervisorLoginIdGroups: number;
        supervisorLocationGroups: number;
        cleanerLoginIdGroups: number;
    };
    supervisors: {
        accepted: number;
        upserted: number;
        skippedInvalid: number;
        skippedDuplicateLoginId: number;
        skippedDuplicateLocation: number;
    };
    cleaners: {
        accepted: number;
        upserted: number;
        skippedInvalid: number;
        skippedDuplicateLoginId: number;
        skippedNoSupervisorMatch: number;
    };
    samples: {
        invalidSupervisorLines: number[];
        invalidCleanerLines: number[];
        cleanerNoSupervisor: Array<{ line: number; loginId: string; location: string }>;
    };
}

function normalizeCsvField(value: string): string {
    const trimmed = value.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        return trimmed.slice(1, -1).trim();
    }
    return trimmed;
}

function parseCsv(path: string): CsvRow[] {
    if (!existsSync(path)) {
        throw new Error(`Bootstrap CSV file not found: ${path}`);
    }

    const raw = readFileSync(path, 'utf8').replace(/^\uFEFF/, '').trim();
    if (!raw) return [];

    const lines = raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((part) => normalizeCsvField(part));
    const rows: CsvRow[] = [];

    for (let i = 1; i < lines.length; i += 1) {
        const parts = lines[i].split(',').map((part) => normalizeCsvField(part));
        const row: Record<string, string> = {};
        headers.forEach((header, idx) => {
            row[header] = parts[idx] ?? '';
        });
        rows.push({ lineNo: i + 1, row });
    }

    return rows;
}

function rowGet(row: Record<string, string>, keys: string[]): string {
    for (const key of keys) {
        const value = row[key];
        if (value && value.trim()) return value.trim();
    }
    return '';
}

function normalizeLocation(value: string): string {
    return value.trim().toLowerCase();
}

function keyOf(row: CsvRow, keys: string[]): string {
    return rowGet(row.row, keys);
}

function reportDuplicates(rows: CsvRow[], label: string, resolveKey: (row: CsvRow) => string): DuplicateReport {
    const seen = new Map<string, number[]>();

    for (const row of rows) {
        const key = resolveKey(row);
        if (!key) continue;
        const list = seen.get(key) ?? [];
        list.push(row.lineNo);
        seen.set(key, list);
    }

    const entries: DuplicateEntry[] = [];
    for (const [key, lines] of seen.entries()) {
        if (lines.length <= 1) continue;
        entries.push({ key, lines });
        // eslint-disable-next-line no-console
        console.log(`[DUPLICATE] ${label} '${key}' appears in lines: ${lines.join(', ')}`);
    }

    return {
        groups: entries.length,
        entries
    };
}

async function upsertUserAccount(opts: {
    tenantId: string;
    loginId: string;
    name: string;
    role: 'supervisor' | 'cleaner';
    phone?: string;
    email?: string;
    workLocation?: string;
    dryRun?: boolean;
}): Promise<{ id: string; name: string; idNumber: string; role: string }> {
    if (opts.dryRun) {
        return {
            id: `dry-${opts.role}-${opts.loginId}`,
            name: opts.name,
            idNumber: opts.loginId,
            role: opts.role
        };
    }

    const passwordHash = await bcrypt.hash(opts.loginId, 12);

    return prismaRaw.userAccount.upsert({
        where: {
            tenantId_idNumber: {
                tenantId: opts.tenantId,
                idNumber: opts.loginId
            }
        },
        update: {
            name: opts.name,
            role: opts.role,
            phone: opts.phone || null,
            email: opts.email || null,
            workLocation: opts.workLocation || null,
            passwordHash
        },
        create: {
            tenantId: opts.tenantId,
            idNumber: opts.loginId,
            name: opts.name,
            role: opts.role,
            phone: opts.phone || null,
            email: opts.email || null,
            workLocation: opts.workLocation || null,
            passwordHash,
            verified: true,
            status: 'active'
        },
        select: {
            id: true,
            name: true,
            idNumber: true,
            role: true
        }
    });
}

async function seedStaffFromCsv(tenantId: string, dryRun: boolean): Promise<StaffSeedSummary> {
    const summary: StaffSeedSummary = {
        skipped: false,
        csv: { supervisors: 0, cleaners: 0 },
        duplicates: {
            supervisorLoginIdGroups: 0,
            supervisorLocationGroups: 0,
            cleanerLoginIdGroups: 0
        },
        supervisors: {
            accepted: 0,
            upserted: 0,
            skippedInvalid: 0,
            skippedDuplicateLoginId: 0,
            skippedDuplicateLocation: 0
        },
        cleaners: {
            accepted: 0,
            upserted: 0,
            skippedInvalid: 0,
            skippedDuplicateLoginId: 0,
            skippedNoSupervisorMatch: 0
        },
        samples: {
            invalidSupervisorLines: [],
            invalidCleanerLines: [],
            cleanerNoSupervisor: []
        }
    };

    const supervisorCsvPath = optional('BOOTSTRAP_SUPERVISOR_FILE');
    const cleanerCsvPath = optional('BOOTSTRAP_CLEANER_FILE');

    if (!supervisorCsvPath || !cleanerCsvPath) {
        // eslint-disable-next-line no-console
        console.log('Staff bootstrap CSV paths not provided. Skipping supervisor/cleaner seeding.');
        summary.skipped = true;
        summary.reason = 'missing_csv_paths';
        return summary;
    }

    const supervisors = parseCsv(supervisorCsvPath);
    const cleaners = parseCsv(cleanerCsvPath);
    summary.csv.supervisors = supervisors.length;
    summary.csv.cleaners = cleaners.length;

    // eslint-disable-next-line no-console
    console.log(`Bootstrap CSV loaded: supervisors=${supervisors.length}, cleaners=${cleaners.length}`);
    const supervisorLoginDup = reportDuplicates(
        supervisors,
        'supervisor login ID',
        (r) => keyOf(r, ['Staff ID', 'staff_id', 'staffId', 'Login ID', 'login_id', 'loginId'])
    );
    const supervisorLocationDup = reportDuplicates(
        supervisors,
        'supervisor location',
        (r) => normalizeLocation(keyOf(r, ['Location', 'location']))
    );
    const cleanerLoginDup = reportDuplicates(
        cleaners,
        'cleaner login ID',
        (r) => keyOf(r, ['Staff ID', 'staff_id', 'staffId', 'Login ID', 'login_id', 'loginId'])
    );
    summary.duplicates.supervisorLoginIdGroups = supervisorLoginDup.groups;
    summary.duplicates.supervisorLocationGroups = supervisorLocationDup.groups;
    summary.duplicates.cleanerLoginIdGroups = cleanerLoginDup.groups;

    const supervisorByLocation = new Map<string, { id: string; name: string; loginId: string }>();
    const seenSupervisorLogin = new Set<string>();

    for (const entry of supervisors) {
        const name = rowGet(entry.row, ['Name', 'name']);
        const loginId = rowGet(entry.row, ['Staff ID', 'staff_id', 'staffId', 'Login ID', 'login_id', 'loginId']);
        const location = rowGet(entry.row, ['Location', 'location']);

        if (!name || !loginId || !location) {
            // eslint-disable-next-line no-console
            console.log(`Skipping invalid supervisor row (line ${entry.lineNo}): ${JSON.stringify(entry.row)}`);
            summary.supervisors.skippedInvalid += 1;
            summary.samples.invalidSupervisorLines.push(entry.lineNo);
            continue;
        }

        const locationKey = normalizeLocation(location);
        if (seenSupervisorLogin.has(loginId)) {
            // eslint-disable-next-line no-console
            console.log(`Skipping supervisor duplicate login ID '${loginId}' at line ${entry.lineNo}`);
            summary.supervisors.skippedDuplicateLoginId += 1;
            continue;
        }
        if (supervisorByLocation.has(locationKey)) {
            // eslint-disable-next-line no-console
            console.log(`Skipping supervisor duplicate location '${location}' at line ${entry.lineNo}; keeping first match`);
            summary.supervisors.skippedDuplicateLocation += 1;
            continue;
        }

        summary.supervisors.accepted += 1;

        const account = await upsertUserAccount({
            tenantId,
            loginId,
            name,
            role: 'supervisor',
            workLocation: location,
            dryRun
        });

        if (dryRun) {
            // eslint-disable-next-line no-console
            console.log(`[DRY-RUN] would upsert supervisor account: ${name} (${loginId})`);
        }

        seenSupervisorLogin.add(loginId);
        summary.supervisors.upserted += 1;
        supervisorByLocation.set(locationKey, {
            id: account.id,
            name: account.name,
            loginId: account.idNumber
        });
    }

    // eslint-disable-next-line no-console
    console.log(`Supervisor accounts ready: ${supervisorByLocation.size}`);

    let cleanerSeeded = 0;
    const seenCleanerLogin = new Set<string>();
    for (const entry of cleaners) {
        const name = rowGet(entry.row, ['Name', 'name']);
        const loginId = rowGet(entry.row, ['Staff ID', 'staff_id', 'staffId', 'Login ID', 'login_id', 'loginId']);
        const location = rowGet(entry.row, ['Location', 'location']);

        if (!name || !loginId || !location) {
            // eslint-disable-next-line no-console
            console.log(`Skipping invalid cleaner row (line ${entry.lineNo}): ${JSON.stringify(entry.row)}`);
            summary.cleaners.skippedInvalid += 1;
            summary.samples.invalidCleanerLines.push(entry.lineNo);
            continue;
        }

        if (seenCleanerLogin.has(loginId)) {
            // eslint-disable-next-line no-console
            console.log(`Skipping cleaner duplicate login ID '${loginId}' at line ${entry.lineNo}`);
            summary.cleaners.skippedDuplicateLoginId += 1;
            continue;
        }

        const supervisor = supervisorByLocation.get(normalizeLocation(location));
        if (!supervisor) {
            // eslint-disable-next-line no-console
            console.log(`Skipping cleaner '${name}' (${loginId}) — no supervisor found for location '${location}'`);
            summary.cleaners.skippedNoSupervisorMatch += 1;
            summary.samples.cleanerNoSupervisor.push({ line: entry.lineNo, loginId, location });
            continue;
        }

        summary.cleaners.accepted += 1;

        await upsertUserAccount({
            tenantId,
            loginId,
            name,
            role: 'cleaner',
            workLocation: location,
            dryRun
        });

        if (dryRun) {
            // eslint-disable-next-line no-console
            console.log(`[DRY-RUN] would upsert cleaner account: ${name} (${loginId}) -> supervisor ${supervisor.name}`);
            cleanerSeeded += 1;
            summary.cleaners.upserted += 1;
            seenCleanerLogin.add(loginId);
            continue;
        }

        const existingCleaner = await prismaRaw.cleaner.findFirst({
            where: {
                tenantId,
                workId: loginId
            }
        });

        if (existingCleaner) {
            await prismaRaw.cleaner.update({
                where: { id: existingCleaner.id },
                data: {
                    name,
                    workLocation: location,
                    supervisorId: supervisor.id,
                    supervisorName: supervisor.name
                }
            });
        } else {
            await prismaRaw.cleaner.create({
                data: {
                    tenantId,
                    name,
                    workId: loginId,
                    workLocation: location,
                    supervisorId: supervisor.id,
                    supervisorName: supervisor.name
                }
            });
        }

        cleanerSeeded += 1;
        summary.cleaners.upserted += 1;
        seenCleanerLogin.add(loginId);
    }

    // eslint-disable-next-line no-console
    console.log(`${dryRun ? '[DRY-RUN] ' : ''}Cleaner accounts + roster ready: ${cleanerSeeded}`);

    return summary;
}

async function main(): Promise<void> {
    const dryRun = flag('BOOTSTRAP_DRY_RUN');
    const tenantSlug = required('BOOTSTRAP_TENANT_SLUG');
    const tenantName = required('BOOTSTRAP_TENANT_NAME');
    const username = required('BOOTSTRAP_MASTER_USERNAME');
    const password = required('BOOTSTRAP_MASTER_PASSWORD');
    const masterName = required('BOOTSTRAP_MASTER_NAME');
    let tenantCreated = false;
    let tenantUpdated = false;
    let masterCreated = false;
    let masterExisting = false;

    if (dryRun) {
        // eslint-disable-next-line no-console
        console.log('[DRY-RUN] Bootstrap validation mode enabled. No database writes will occur.');
        const existingTenant = await prismaRaw.tenant.findUnique({ where: { slug: tenantSlug } });
        const tenantId = existingTenant?.id ?? `dry-${tenantSlug}`;
        let dryRunMasterExists = false;

        if (existingTenant) {
            // eslint-disable-next-line no-console
            console.log(`[DRY-RUN] tenant exists: ${tenantSlug} (${tenantId}); would update name to '${tenantName}' if different.`);
        } else {
            // eslint-disable-next-line no-console
            console.log(`[DRY-RUN] tenant missing: would create tenant '${tenantSlug}' ('${tenantName}').`);
        }

        if (existingTenant) {
            const existingMaster = await prismaRaw.masterUser.findFirst({
                where: { tenantId: existingTenant.id, username }
            });
            if (existingMaster) {
                dryRunMasterExists = true;
                // eslint-disable-next-line no-console
                console.log(`[DRY-RUN] master '${username}' already exists for tenant '${tenantSlug}'.`);
            } else {
                // eslint-disable-next-line no-console
                console.log(`[DRY-RUN] would create master '${username}' (${masterName}).`);
            }
        } else {
            // eslint-disable-next-line no-console
            console.log(`[DRY-RUN] would create master '${username}' (${masterName}) after tenant creation.`);
        }

        const staffSummary = await seedStaffFromCsv(tenantId, true);
        // eslint-disable-next-line no-console
        console.log(`BOOTSTRAP_SUMMARY ${JSON.stringify({
            dryRun: true,
            tenant: {
                slug: tenantSlug,
                exists: Boolean(existingTenant)
            },
            master: {
                username,
                exists: dryRunMasterExists
            },
            staff: staffSummary
        })}`);
        return;
    }

    const existingTenantBeforeUpsert = await prismaRaw.tenant.findUnique({ where: { slug: tenantSlug } });
    const tenant = await prismaRaw.tenant.upsert({
        where: { slug: tenantSlug },
        update: { name: tenantName },
        create: { slug: tenantSlug, name: tenantName, status: 'active' }
    });
    tenantCreated = !existingTenantBeforeUpsert;
    tenantUpdated = Boolean(existingTenantBeforeUpsert && existingTenantBeforeUpsert.name !== tenantName);
    // eslint-disable-next-line no-console
    console.log(`Tenant ready: ${tenant.slug} (${tenant.id})`);

    const existingMaster = await prismaRaw.masterUser.findFirst({
        where: { tenantId: tenant.id, username }
    });

    if (existingMaster) {
        // eslint-disable-next-line no-console
        console.log(`Master '${username}' already exists for tenant '${tenant.slug}'. Skipping.`);
        masterExisting = true;
        const staffSummary = await seedStaffFromCsv(tenant.id, false);
        // eslint-disable-next-line no-console
        console.log(`BOOTSTRAP_SUMMARY ${JSON.stringify({
            dryRun: false,
            tenant: {
                slug: tenant.slug,
                id: tenant.id,
                created: tenantCreated,
                updated: tenantUpdated
            },
            master: {
                username,
                created: masterCreated,
                existing: masterExisting
            },
            staff: staffSummary
        })}`);
        return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const created = await prismaRaw.masterUser.create({
        data: {
            tenantId: tenant.id,
            username,
            passwordHash,
            name: masterName,
            sessionVersion: 0
        }
    });
    // eslint-disable-next-line no-console
    console.log(`Master created: ${created.username} (${created.id})`);
    masterCreated = true;
    const staffSummary = await seedStaffFromCsv(tenant.id, false);

    // eslint-disable-next-line no-console
    console.log(`BOOTSTRAP_SUMMARY ${JSON.stringify({
        dryRun: false,
        tenant: {
            slug: tenant.slug,
            id: tenant.id,
            created: tenantCreated,
            updated: tenantUpdated
        },
        master: {
            username,
            created: masterCreated,
            existing: masterExisting
        },
        staff: staffSummary
    })}`);
}

main()
    .then(() => prismaRaw.$disconnect())
    .catch(async (err) => {
        // eslint-disable-next-line no-console
        console.error(err);
        await prismaRaw.$disconnect();
        process.exit(1);
    });
