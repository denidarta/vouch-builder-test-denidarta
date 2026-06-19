import { Test, TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { EventNormalizerService } from './event-normalizer.service';
import { RawEvent } from '../../common/types/event.interface';

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

describe('EventNormalizerService', () => {
  let service: EventNormalizerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventNormalizerService,
        {
          provide: getLoggerToken(EventNormalizerService.name),
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get(EventNormalizerService);
  });

  describe('normalizeStructuredEvents', () => {
    it('should convert RawEvent to NormalizedEvent with source=system and confidence=high', () => {
      const raw: RawEvent[] = [
        {
          id: 'evt_0001',
          timestamp: '2026-05-25T23:14:00+08:00',
          type: 'check_in',
          room: '204',
          guest: 'Tan Wei Ming',
          description: 'Late check-in, smooth.',
          status: 'resolved',
        },
      ];

      const result = service.normalize(raw, []);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'evt_0001',
        source: 'system',
        confidence: 'high',
        type: 'check_in',
        room: '204',
      });
    });

    it('should preserve null room and guest fields', () => {
      const raw: RawEvent[] = [
        {
          id: 'evt_0008',
          timestamp: '2026-05-27T01:40:00+08:00',
          type: 'facilities',
          room: null,
          guest: null,
          description: 'Water leak in corridor.',
          status: 'unresolved',
        },
      ];

      const result = service.normalize(raw, []);

      expect(result[0].room).toBeNull();
      expect(result[0].guest).toBeNull();
    });
  });

  describe('normalizeNightLogs', () => {
    const sampleLog = `Few things to pass on:

- Room 112 aircon — maintenance finally came to look at it tonight. Bad news, compressor part needs ordering.

- 309 — the guy with the deposit issue from Tuesday is still not settled.

- 312 那个 no-show（昨晚的 guaranteed booking）— 我已经按 booking terms 帮他收了一晚的费用了，这件事 settle 了。

- Someone called about wifi dropping. I couldn't catch which room.`;

    it('should extract room numbers from bullet entries', () => {
      const result = service.normalize(
        [],
        [{ date: '2026-05-27', content: sampleLog }],
      );
      const rooms = result.map((e) => e.room);
      expect(rooms).toContain('112');
      expect(rooms).toContain('309');
    });

    it('should tag Chinese text entries with language=zh', () => {
      const result = service.normalize(
        [],
        [{ date: '2026-05-27', content: sampleLog }],
      );
      const zhEntries = result.filter((e) => e.language === 'zh');
      expect(zhEntries.length).toBeGreaterThanOrEqual(1);
    });

    it('should assign low confidence to entries with missing room', () => {
      const result = service.normalize(
        [],
        [{ date: '2026-05-27', content: sampleLog }],
      );
      const wifiEntry = result.find((e) => e.description.includes('wifi'));
      expect(wifiEntry?.confidence).toBe('low');
    });

    it('should classify types by keywords', () => {
      const result = service.normalize(
        [],
        [{ date: '2026-05-27', content: sampleLog }],
      );
      const aircon = result.find((e) => e.description.includes('aircon'));
      expect(aircon?.type).toBe('maintenance');
      const deposit = result.find((e) => e.description.includes('deposit'));
      expect(deposit?.type).toBe('deposit_issue');
    });

    it('should assign source=night_log and synthetic IDs', () => {
      const result = service.normalize(
        [],
        [{ date: '2026-05-27', content: sampleLog }],
      );
      result.forEach((e) => {
        expect(e.source).toBe('night_log');
        expect(e.id).toMatch(/^log_\d{4}$/);
      });
    });
  });
});
