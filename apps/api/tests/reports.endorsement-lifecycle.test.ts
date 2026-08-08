import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    reportsList: vi.fn(),
    reportsFindByPublicId: vi.fn(),
    reportsUpdate: vi.fn(),
    reportsAssignToCleaner: vi.fn(),
    usersFindById: vi.fn(),
    cleanersFindAllForUser: vi.fn(),
    cleanersFindById: vi.fn(),
    cleanersClearAssignment: vi.fn(),
    usersFindByIdNumber: vi.fn(),
    mastersListAll: vi.fn(),
    pushSend: vi.fn(),
    resolvePhotoString: vi.fn(),
    resolvePhotoArray: vi.fn(),
    ingestPhotoString: vi.fn(),
    ingestPhotoArray: vi.fn()
}));

vi.mock('../src/domain/reports/reports.repository', () => ({
    reportsRepository: {
        list: mocks.reportsList,
        findByPublicId: mocks.reportsFindByPublicId,
        update: mocks.reportsUpdate,
        assignToCleaner: mocks.reportsAssignToCleaner
    }
}));

vi.mock('../src/domain/users/users.repository', () => ({
    usersRepository: {
        findById: mocks.usersFindById,
        findByIdNumber: mocks.usersFindByIdNumber
    }
}));

vi.mock('../src/domain/cleaners/cleaners.repository', () => ({
    cleanersRepository: {
        findById: mocks.cleanersFindById,
        findAllForUser: mocks.cleanersFindAllForUser,
        clearAssignmentByTaskId: mocks.cleanersClearAssignment
    }
}));

vi.mock('../src/domain/master/master.repository', () => ({
    masterRepository: {
        listAll: mocks.mastersListAll
    }
}));

vi.mock('../src/domain/notifications/push-notifications.service', () => ({
    pushNotificationsService: {
        sendToRecipients: mocks.pushSend
    }
}));

vi.mock('../src/domain/photos/photos.service', () => ({
    photosService: {
        resolvePhotoString: mocks.resolvePhotoString,
        resolvePhotoArray: mocks.resolvePhotoArray,
        ingestPhotoString: mocks.ingestPhotoString,
        ingestPhotoArray: mocks.ingestPhotoArray
    }
}));

import { reportsService } from '../src/domain/reports/reports.service';

function baseReportRow(overrides: Record<string, unknown> = {}) {
    return {
        id: 'rep-1',
        publicId: 'RPT-1',
        status: 'Assigned',
        timestamp: new Date('2026-05-01T10:00:00.000Z'),
        priority: 'Medium',
        userId: 'reporter-1',
        userName: 'Reporter A',
        assignedTo: 'Cleaner A',
        assignedToCleanerId: 'cleaner-roster-7',
        assignedBySupervisorId: 'supervisor-1',
        assignedBySupervisorName: 'Supervisor A',
        evidencePhoto: null,
        photos: [],
        resolutionPhoto: null,
        photoTimestamp: null,
        resolutionTimestamp: null,
        reviewedAt: null,
        reviewedBySupervisorId: null,
        reviewedBySupervisorName: null,
        reviewNotes: null,
        coordinates: null,
        resolutionCoordinates: null,
        resolutionDistanceMeters: null,
        category: null,
        location: 'Block A',
        details: null,
        reporterPhone: null,
        ...overrides
    };
}

describe('three-role endorsement lifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.resolvePhotoString.mockResolvedValue(null);
        mocks.resolvePhotoArray.mockResolvedValue([]);
        mocks.ingestPhotoString.mockImplementation(async (v: string) => v);
        mocks.ingestPhotoArray.mockImplementation(async (v: unknown[]) => v);
        mocks.mastersListAll.mockResolvedValue([]);
        mocks.pushSend.mockResolvedValue(undefined);
        mocks.cleanersClearAssignment.mockResolvedValue(undefined);
    });

    it("rewrites cleaner-sent 'Resolved' to 'Awaiting Endorsement' and notifies the assigning supervisor", async () => {
        const existing = baseReportRow({ status: 'In Progress' });
        mocks.reportsFindByPublicId.mockResolvedValue(existing);
        mocks.reportsUpdate.mockResolvedValue(baseReportRow({ status: 'Awaiting Endorsement' }));

        const result = await reportsService.update(
            'RPT-1',
            { status: 'Resolved' },
            { role: 'cleaner', userId: 'user-cleaner-1', name: 'Cleaner A' }
        );

        expect(mocks.reportsUpdate).toHaveBeenCalledWith(
            'RPT-1',
            expect.objectContaining({
                status: 'Awaiting Endorsement',
                reviewedAt: null,
                reviewedBySupervisorId: null,
                reviewedBySupervisorName: null,
                reviewNotes: null
            })
        );
        expect(result.status).toBe('Awaiting Endorsement');
        expect(mocks.pushSend).toHaveBeenCalledWith(
            expect.objectContaining({
                userIds: ['supervisor-1'],
                type: 'report_pending_endorsement'
            })
        );
        expect(mocks.cleanersClearAssignment).not.toHaveBeenCalled();
    });

    it("accepts cleaner-sent 'Awaiting Endorsement' verbatim (Android client path)", async () => {
        const existing = baseReportRow({ status: 'In Progress' });
        mocks.reportsFindByPublicId.mockResolvedValue(existing);
        mocks.reportsUpdate.mockResolvedValue(baseReportRow({ status: 'Awaiting Endorsement' }));

        const result = await reportsService.update(
            'RPT-1',
            { status: 'Awaiting Endorsement' },
            { role: 'cleaner', userId: 'user-cleaner-1', name: 'Cleaner A' }
        );

        expect(result.status).toBe('Awaiting Endorsement');
        expect(mocks.pushSend).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'report_pending_endorsement' })
        );
    });

    it('returns awaiting-endorsement reports to supervisors in the unfiltered list', async () => {
        mocks.reportsList.mockResolvedValue([
            baseReportRow({ status: 'Awaiting Endorsement' }),
            baseReportRow({ id: 'rep-2', publicId: 'RPT-2', status: 'Assigned' })
        ]);

        const reports = await reportsService.list({
            role: 'supervisor',
            userId: 'supervisor-9',
            name: 'Supervisor B'
        });

        expect(mocks.reportsList).toHaveBeenCalledWith({});
        expect(reports.map((r) => r.status)).toEqual(['Awaiting Endorsement', 'Assigned']);
    });

    it('allows supervisor to endorse Awaiting Endorsement → Resolved with review stamps', async () => {
        const existing = baseReportRow({ status: 'Awaiting Endorsement' });
        mocks.reportsFindByPublicId.mockResolvedValue(existing);
        mocks.reportsUpdate.mockResolvedValue(baseReportRow({ status: 'Resolved' }));
        mocks.cleanersFindById.mockResolvedValue({ id: 'cleaner-roster-7', workId: '2159', name: 'Cleaner A' });
        mocks.usersFindByIdNumber.mockResolvedValue({ id: 'user-cleaner-1', idNumber: '2159', name: 'Cleaner A' });

        await reportsService.update(
            'RPT-1',
            { status: 'Resolved' },
            { role: 'supervisor', userId: 'supervisor-1', name: 'Supervisor A' }
        );

        expect(mocks.reportsUpdate).toHaveBeenCalledWith(
            'RPT-1',
            expect.objectContaining({
                status: 'Resolved',
                reviewedBySupervisorId: 'supervisor-1',
                reviewedBySupervisorName: 'Supervisor A'
            })
        );
        // Endorsement clears the cleaner's assignment so the slot frees up.
        expect(mocks.cleanersClearAssignment).toHaveBeenCalledWith('RPT-1');
        // Cleaner and reporter both get the "issue resolved" notification.
        expect(mocks.pushSend).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'report_resolved_reporter',
                userIds: expect.arrayContaining(['reporter-1', 'user-cleaner-1'])
            })
        );
    });

    it('allows supervisor to reject Awaiting Endorsement back to Rejected with notes', async () => {
        const existing = baseReportRow({ status: 'Awaiting Endorsement' });
        mocks.reportsFindByPublicId.mockResolvedValue(existing);
        mocks.reportsUpdate.mockResolvedValue(baseReportRow({ status: 'Rejected' }));
        mocks.cleanersFindById.mockResolvedValue({ id: 'cleaner-roster-7', workId: '2159', name: 'Cleaner A' });
        mocks.usersFindByIdNumber.mockResolvedValue({ id: 'user-cleaner-1', idNumber: '2159', name: 'Cleaner A' });

        await reportsService.update(
            'RPT-1',
            { status: 'Rejected', reviewNotes: 'Photo unclear' },
            { role: 'supervisor', userId: 'supervisor-1', name: 'Supervisor A' }
        );

        expect(mocks.reportsUpdate).toHaveBeenCalledWith(
            'RPT-1',
            expect.objectContaining({
                status: 'Rejected',
                reviewNotes: 'Photo unclear',
                reviewedBySupervisorId: 'supervisor-1'
            })
        );
        // Reject does NOT clear the assignment — the cleaner must keep working.
        expect(mocks.cleanersClearAssignment).not.toHaveBeenCalled();
        expect(mocks.pushSend).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'report_rejected',
                userIds: expect.arrayContaining(['user-cleaner-1', 'reporter-1', 'supervisor-1'])
            })
        );
    });

    it('blocks supervisor from rejecting a report that is not awaiting endorsement', async () => {
        const existing = baseReportRow({ status: 'In Progress' });
        mocks.reportsFindByPublicId.mockResolvedValue(existing);

        await expect(
            reportsService.update(
                'RPT-1',
                { status: 'Rejected' },
                { role: 'supervisor', userId: 'supervisor-1', name: 'Supervisor A' }
            )
        ).rejects.toThrow(/awaiting endorsement/i);
        expect(mocks.reportsUpdate).not.toHaveBeenCalled();
    });

    it('blocks cleaner from rejecting a report', async () => {
        const existing = baseReportRow({ status: 'Awaiting Endorsement' });
        mocks.reportsFindByPublicId.mockResolvedValue(existing);

        await expect(
            reportsService.update(
                'RPT-1',
                { status: 'Rejected' },
                { role: 'cleaner', userId: 'user-cleaner-1', name: 'Cleaner A' }
            )
        ).rejects.toThrow(/cleaners cannot reject/i);
        expect(mocks.reportsUpdate).not.toHaveBeenCalled();
    });
});
