import { Test, TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { ShiftGrouperService } from './shift-grouper.service';
import { NormalizedEvent } from '../../common/types/event.interface';

const mockLogger = { info: jest.fn(), warn: jest.fn() };

describe('ShiftGrouperService', () => {
  let service: ShiftGrouperService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShiftGrouperService,
        {
          provide: getLoggerToken(ShiftGrouperService.name),
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get(ShiftGrouperService);
  });

  it('should group events into correct shift window', () => {
    const events: NormalizedEvent[] = [
      {
        id: 'evt_1',
        source: 'system',
        timestamp: '2026-05-29T23:30:00+08:00',
        type: 'check_in',
        room: '101',
        guest: null,
        description: 'test',
        status: 'resolved',
        confidence: 'high',
      },
      {
        id: 'evt_2',
        source: 'system',
        timestamp: '2026-05-30T02:00:00+08:00',
        type: 'complaint',
        room: '102',
        guest: null,
        description: 'test',
        status: 'resolved',
        confidence: 'high',
      },
      {
        id: 'evt_3',
        source: 'system',
        timestamp: '2026-05-30T08:00:00+08:00',
        type: 'note',
        room: '103',
        guest: null,
        description: 'outside shift',
        status: 'resolved',
        confidence: 'high',
      },
    ];

    const result = service.groupByShift(events, '2026-05-30', '+08:00');

    expect(result.currentShift.events).toHaveLength(2);
    expect(result.currentShift.events.map((e) => e.id)).toEqual([
      'evt_1',
      'evt_2',
    ]);
    expect(result.currentShift.shiftDate).toBe('2026-05-30');
  });

  it('should separate prior shifts from current shift', () => {
    const events: NormalizedEvent[] = [
      {
        id: 'evt_old',
        source: 'system',
        timestamp: '2026-05-28T23:30:00+08:00',
        type: 'maintenance',
        room: '112',
        guest: null,
        description: 'old shift',
        status: 'unresolved',
        confidence: 'high',
      },
      {
        id: 'evt_new',
        source: 'system',
        timestamp: '2026-05-29T23:30:00+08:00',
        type: 'maintenance',
        room: '112',
        guest: null,
        description: 'current shift',
        status: 'unresolved',
        confidence: 'high',
      },
    ];

    const result = service.groupByShift(events, '2026-05-30', '+08:00');

    expect(result.currentShift.events).toHaveLength(1);
    expect(result.currentShift.events[0].id).toBe('evt_new');
    expect(result.priorShifts.length).toBeGreaterThanOrEqual(1);
    expect(
      result.priorShifts.some((s) => s.events.some((e) => e.id === 'evt_old')),
    ).toBe(true);
  });

  it('should place night log events (null timestamp) into no shift', () => {
    const events: NormalizedEvent[] = [
      {
        id: 'log_0001',
        source: 'night_log',
        timestamp: null,
        type: 'maintenance',
        room: '112',
        guest: null,
        description: 'aircon still broken',
        status: 'unresolved',
        confidence: 'high',
        rawText: 'aircon still broken',
      },
    ];

    const result = service.groupByShift(events, '2026-05-30', '+08:00');

    expect(result.currentShift.events).toHaveLength(0);
  });
});
