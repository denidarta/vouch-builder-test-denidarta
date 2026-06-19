import { Test, TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { IssueReconcilerService } from './issue-reconciler.service';
import { ShiftGroup } from '../../common/types/handover.interface';
import { NormalizedEvent } from '../../common/types/event.interface';

const mockLogger = { info: jest.fn(), warn: jest.fn() };

const makeEvent = (overrides: Partial<NormalizedEvent>): NormalizedEvent => ({
  id: 'evt_test',
  source: 'system',
  timestamp: '2026-05-30T01:00:00+08:00',
  type: 'note',
  room: null,
  guest: null,
  description: 'test',
  status: 'resolved',
  confidence: 'high',
  ...overrides,
});

const makeShift = (shiftDate: string, events: NormalizedEvent[]): ShiftGroup => ({
  shiftDate,
  start: `${shiftDate}T23:00:00+08:00`,
  end: `${shiftDate}T07:00:00+08:00`,
  events,
});

describe('IssueReconcilerService', () => {
  let service: IssueReconcilerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IssueReconcilerService,
        { provide: getLoggerToken(IssueReconcilerService.name), useValue: mockLogger },
      ],
    }).compile();

    service = module.get(IssueReconcilerService);
  });

  it('should mark new issues as new_tonight', () => {
    const current = makeShift('2026-05-30', [
      makeEvent({ id: 'evt_1', type: 'complaint', room: '305', status: 'resolved' }),
    ]);

    const result = service.reconcile(current, []);

    expect(result[0].status).toBe('new_tonight');
  });

  it('should mark unresolved issues from prior shifts as still_open', () => {
    const prior = makeShift('2026-05-27', [
      makeEvent({ id: 'evt_old', type: 'maintenance', room: '112', status: 'unresolved' }),
    ]);
    const current = makeShift('2026-05-30', [
      makeEvent({ id: 'evt_new', type: 'maintenance', room: '112', status: 'unresolved' }),
    ]);

    const result = service.reconcile(current, [prior]);

    const thread = result.find((r) => r.room === '112');
    expect(thread?.status).toBe('still_open');
    expect(thread?.nightsOpen).toBeGreaterThan(0);
  });

  it('should mark previously open issues as newly_resolved', () => {
    const prior = makeShift('2026-05-27', [
      makeEvent({ id: 'evt_old', type: 'facilities', room: null, status: 'unresolved',
        description: 'Water leak near 215' }),
    ]);
    const current = makeShift('2026-05-30', [
      makeEvent({ id: 'evt_new', type: 'facilities', room: null, status: 'resolved',
        description: 'Leak near 215 resolved' }),
    ]);

    const result = service.reconcile(current, [prior]);

    const thread = result.find((r) => r.category === 'facilities');
    expect(thread?.status).toBe('newly_resolved');
  });

  it('should detect contradictions in same thread', () => {
    const prior = makeShift('2026-05-27', [
      makeEvent({ id: 'evt_1', type: 'no_show', room: '312', status: 'unresolved',
        description: 'NOT yet charged' }),
    ]);
    const priorLog = makeShift('2026-05-28', [
      makeEvent({ id: 'log_1', type: 'no_show', room: '312', status: 'resolved',
        source: 'night_log', description: 'charge applied, settled' }),
    ]);
    const current = makeShift('2026-05-29', [
      makeEvent({ id: 'evt_2', type: 'finance_note', room: '312', status: 'pending',
        description: 'Guest disputes the charge' }),
    ]);

    const result = service.reconcile(current, [prior, priorLog]);

    const thread = result.find((r) => r.room === '312');
    expect(thread?.contradiction).toBeDefined();
  });
});
