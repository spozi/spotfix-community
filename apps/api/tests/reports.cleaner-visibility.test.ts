import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    reportsList: vi.fn(),
    usersFindById: vi.fn(),
    cleanersFindByWorkId: vi.fn(),
    cleanersFindAllForUser: vi.fn(),
    resolvePhotoString: vi.fn(),
    resolvePhotoArray: vi.fn()
}));

vi.mock('../src/domain/reports/reports.repository', () => ({
    reportsRepository: {
        list: mocks.reportsList
    }
}));

vi.mock('../src/domain/users/users.repository', () => ({
    usersRepository: {
        findById: mocks.usersFindById
    }
}));

vi.mock('../src/domain/cleaners/cleaners.repository', () => ({
    cleanersRepository: {
        findByWorkId: mocks.cleanersFindByWorkId,
        findAllForUser: mocks.cleanersFindAllForUser,
        clearAssignmentByTaskId: vi.fn()
    }
}));

vi.mock('../src/domain/photos/photos.service', () => ({
    photosService: {
        resolvePhotoString: mocks.resolvePhotoString,
        resolvePhotoArray: mocks.resolvePhotoArray,
        ingestPhotoString: vi.fn(),
        ingestPhotoArray: vi.fn()
    }
}));

import { reportsService } from '../src/domain/reports/reports.service';

describe('reportsService.list cleaner visibility', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.resolvePhotoString.mockResolvedValue(null);
        mocks.resolvePhotoArray.mockResolvedValue([]);
    });

    it('filters cleaner report listing by linked cleaner roster and cleaner name', async () => {
        mocks.usersFindById.mockResolvedValue({
            id: 'user-cleaner-1',
            idNumber: '2159',
            name: 'Cleaner A'
        });
        mocks.cleanersFindAllForUser.mockResolvedValue([
            { id: 'cleaner-roster-7', workId: '2159', name: 'Cleaner A' }
        ]);
        mocks.reportsList.mockResolvedValue([
            {
                id: 'rep-1',
                publicId: 'RPT-1',
                status: 'In Progress',
                timestamp: new Date('2026-05-01T10:00:00.000Z'),
                priority: 'Medium',
                userId: 'reporter-1',
                userName: 'Reporter A',
                assignedToCleanerId: 'cleaner-roster-7',
                assignedTo: 'Cleaner A',
                evidencePhoto: null,
                photos: [],
                resolutionPhoto: null,
                photoTimestamp: null,
                resolutionTimestamp: null
            }
        ]);

        const reports = await reportsService.list({
            role: 'cleaner',
            userId: 'user-cleaner-1',
            name: 'Cleaner A'
        });

        expect(mocks.usersFindById).toHaveBeenCalledWith('user-cleaner-1');
        expect(mocks.cleanersFindAllForUser).toHaveBeenCalledWith({
            idNumber: '2159',
            name: 'Cleaner A'
        });
        expect(mocks.reportsList).toHaveBeenCalledWith({
            cleanerIds: ['cleaner-roster-7'],
            cleanerNames: ['Cleaner A']
        });
        expect(reports).toHaveLength(1);
        expect(reports[0]).toMatchObject({
            id: 'RPT-1',
            assignedToCleanerId: 'cleaner-roster-7',
            reporterName: 'Reporter A'
        });
    });

    it('still resolves assigned reports when the roster name differs from the user account name', async () => {
        mocks.usersFindById.mockResolvedValue({
            id: 'user-cleaner-2',
            idNumber: '7788',
            name: 'Ahmad bin Ali'
        });
        mocks.cleanersFindAllForUser.mockResolvedValue([
            { id: 'cleaner-roster-9', workId: '7788', name: 'AHMAD ALI' }
        ]);
        mocks.reportsList.mockResolvedValue([]);

        await reportsService.list({
            role: 'cleaner',
            userId: 'user-cleaner-2',
            name: 'Ahmad bin Ali'
        });

        expect(mocks.reportsList).toHaveBeenCalledWith({
            cleanerIds: ['cleaner-roster-9'],
            cleanerNames: ['Ahmad bin Ali', 'AHMAD ALI']
        });
    });

    it('falls back to cleaner name match when no roster row is linked', async () => {
        mocks.usersFindById.mockResolvedValue({
            id: 'user-cleaner-3',
            idNumber: '0001',
            name: 'Solo Cleaner'
        });
        mocks.cleanersFindAllForUser.mockResolvedValue([]);
        mocks.reportsList.mockResolvedValue([]);

        await reportsService.list({
            role: 'cleaner',
            userId: 'user-cleaner-3',
            name: 'Solo Cleaner'
        });

        expect(mocks.reportsList).toHaveBeenCalledWith({
            cleanerIds: [],
            cleanerNames: ['Solo Cleaner']
        });
    });

    it('returns empty list when cleaner account does not exist', async () => {
        mocks.usersFindById.mockResolvedValue(null);

        const reports = await reportsService.list({
            role: 'cleaner',
            userId: 'missing-cleaner-user',
            name: 'Cleaner Missing'
        });

        expect(reports).toEqual([]);
        expect(mocks.cleanersFindAllForUser).not.toHaveBeenCalled();
        expect(mocks.reportsList).not.toHaveBeenCalled();
    });

    it('keeps staff-wide listing for non-cleaner roles', async () => {
        mocks.reportsList.mockResolvedValue([]);

        await reportsService.list({
            role: 'supervisor',
            userId: 'supervisor-1',
            name: 'Supervisor A'
        });

        expect(mocks.reportsList).toHaveBeenCalledWith({});
        expect(mocks.usersFindById).not.toHaveBeenCalled();
        expect(mocks.cleanersFindAllForUser).not.toHaveBeenCalled();
    });
});
