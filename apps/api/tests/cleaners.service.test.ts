import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    cleanersList: vi.fn(),
    usersFindById: vi.fn()
}));

vi.mock('../src/domain/cleaners/cleaners.repository', () => ({
    cleanersRepository: {
        list: mocks.cleanersList,
        findById: vi.fn(),
        create: vi.fn(),
        setSupervisor: vi.fn(),
        assignTask: vi.fn()
    }
}));

vi.mock('../src/domain/users/users.repository', () => ({
    usersRepository: {
        findById: mocks.usersFindById,
        findByIdNumber: vi.fn()
    }
}));

vi.mock('../src/domain/master/master.repository', () => ({
    masterRepository: {
        listAll: vi.fn()
    }
}));

vi.mock('../src/domain/notifications/push-notifications.service', () => ({
    pushNotificationsService: {
        sendToRecipients: vi.fn()
    }
}));

vi.mock('../src/domain/reports/reports.repository', () => ({
    reportsRepository: {
        assignToCleaner: vi.fn()
    }
}));

import { cleanersService } from '../src/domain/cleaners/cleaners.service';

describe('cleanersService.list', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the isBusy compatibility flag expected by Android workforce screens', async () => {
        mocks.cleanersList.mockResolvedValue([
            {
                id: 'cleaner-1',
                name: 'Cleaner A',
                workId: 'C-1001',
                phone: '0123456789',
                workLocation: 'Library',
                supervisorId: 'sup-1',
                supervisorName: 'Supervisor A',
                assignedTaskId: 'RPT-100001',
                busyUntil: '2026-05-17T06:00:00.000Z'
            }
        ]);

        const cleaners = await cleanersService.list({ role: 'master', userId: 'master-1' }, {});

        expect(mocks.cleanersList).toHaveBeenCalledWith({ supervisorId: undefined, workLocation: undefined });
        expect(cleaners).toHaveLength(1);
        expect(cleaners[0]).toMatchObject({
            _id: 'cleaner-1',
            name: 'Cleaner A',
            workId: 'C-1001',
            phone: '0123456789',
            workLocation: 'Library',
            supervisorId: 'sup-1',
            supervisorName: 'Supervisor A',
            isBusy: true,
            assignedTaskId: 'RPT-100001',
            status: 'Busy'
        });
        expect(cleaners[0].busyUntil).toBeInstanceOf(Date);
    });
});