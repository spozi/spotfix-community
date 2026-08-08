import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    reportsList: vi.fn(),
    cleanersList: vi.fn()
}));

vi.mock('../src/domain/reports/reports.repository', () => ({
    reportsRepository: {
        list: mocks.reportsList
    }
}));

vi.mock('../src/domain/cleaners/cleaners.repository', () => ({
    cleanersRepository: {
        list: mocks.cleanersList,
        findByWorkId: vi.fn(),
        clearAssignmentByTaskId: vi.fn()
    }
}));

import { reportsService } from '../src/domain/reports/reports.service';

describe('reportsService.getPublicStatusBoard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('builds the public summary buckets from reports and cleaners', async () => {
        const now = new Date('2026-05-15T09:00:00.000Z');
        vi.useFakeTimers();
        vi.setSystemTime(now);

        mocks.reportsList.mockResolvedValue([
            {
                id: 'db-1',
                publicId: 'RPT-100001',
                status: 'Reported',
                priority: 'Medium',
                category: 'Litter',
                location: 'Library',
                details: 'Bins overflowing',
                assignedTo: null,
                resolutionTimestamp: null,
                timestamp: new Date('2026-05-15T08:30:00.000Z')
            },
            {
                id: 'db-2',
                publicId: 'RPT-100002',
                status: 'In Progress',
                priority: 'High',
                category: 'Spill',
                location: 'Lobby',
                details: 'Wet floor',
                assignedTo: 'Cleaner A',
                resolutionTimestamp: null,
                timestamp: new Date('2026-05-15T08:00:00.000Z')
            },
            {
                id: 'db-3',
                publicId: 'RPT-100003',
                status: 'Resolved',
                priority: 'Critical',
                category: 'Damage',
                location: 'Lecture Hall',
                details: 'Broken seat fixed',
                assignedTo: 'Cleaner B',
                resolutionTimestamp: '2026-05-15T07:45:00.000Z',
                timestamp: new Date('2026-05-15T06:00:00.000Z')
            }
        ]);

        mocks.cleanersList.mockResolvedValue([
            {
                id: 'cleaner-1',
                name: 'Cleaner A',
                workLocation: 'Lobby',
                assignedTaskId: 'RPT-100002',
                busyUntil: null
            },
            {
                id: 'cleaner-2',
                name: 'Cleaner B',
                workLocation: 'Lecture Hall',
                assignedTaskId: null,
                busyUntil: null
            }
        ]);

        const board = await reportsService.getPublicStatusBoard();

        expect(board.summary).toEqual({
            total: 3,
            open: 1,
            pending: 1,
            resolved: 1,
            urgent: 1,
            cleaners: 2,
            availableCleaners: 1,
            busyCleaners: 1
        });
        expect(board.reports.map((report) => report.id)).toEqual(['RPT-100001', 'RPT-100002', 'RPT-100003']);
        expect(board.cleaners).toEqual([
            {
                _id: 'cleaner-1',
                name: 'Cleaner A',
                workLocation: 'Lobby',
                status: 'Busy',
                assignedTaskId: 'RPT-100002'
            },
            {
                _id: 'cleaner-2',
                name: 'Cleaner B',
                workLocation: 'Lecture Hall',
                status: 'Free',
                assignedTaskId: undefined
            }
        ]);

        vi.useRealTimers();
    });

    it('treats legacy Pending and Submitted rows as Reported on the public board', async () => {
        mocks.reportsList.mockResolvedValue([
            {
                id: 'db-legacy-pending',
                publicId: 'RPT-100010',
                status: 'Pending',
                priority: 'Medium',
                timestamp: new Date('2026-05-15T08:30:00.000Z')
            },
            {
                id: 'db-legacy-submitted',
                publicId: 'RPT-100011',
                status: 'Submitted',
                priority: 'Low',
                timestamp: new Date('2026-05-15T08:20:00.000Z')
            },
            {
                id: 'db-assigned',
                publicId: 'RPT-100012',
                status: 'Assigned',
                priority: 'High',
                timestamp: new Date('2026-05-15T08:10:00.000Z')
            }
        ]);
        mocks.cleanersList.mockResolvedValue([]);

        const board = await reportsService.getPublicStatusBoard();

        expect(board.reports.map((report) => report.status)).toEqual(['Reported', 'Reported', 'Assigned']);
        expect(board.summary).toMatchObject({
            total: 3,
            pending: 3,
            open: 1,
            urgent: 1
        });
    });
});
