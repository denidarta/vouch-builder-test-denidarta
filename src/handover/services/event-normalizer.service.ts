import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  RawEvent,
  NightLog,
  NormalizedEvent,
  EventStatus,
} from '../../common/types/event.interface';
import { EVENT_TYPE_KEYWORDS } from '../../common/constants/event-type-keywords';
import { RESOLVED_INDICATORS, UNRESOLVED_INDICATORS } from '../../common/constants/status-indicators';

@Injectable()
export class EventNormalizerService {
  constructor(
    @InjectPinoLogger(EventNormalizerService.name)
    private readonly logger: PinoLogger,
  ) {}

  normalize(events: RawEvent[], nightLogs: NightLog[]): NormalizedEvent[] {
    const normalized: NormalizedEvent[] = [];

    const structuredEvents = this.normalizeStructuredEvents(events);
    normalized.push(...structuredEvents);

    const logEvents = this.normalizeNightLogs(nightLogs);
    normalized.push(...logEvents);

    this.logger.info(
      {
        step: 'event-normalizer',
        structuredCount: structuredEvents.length,
        nightLogCount: logEvents.length,
        totalCount: normalized.length,
      },
      'Normalization complete',
    );

    return normalized;
  }

  private normalizeStructuredEvents(events: RawEvent[]): NormalizedEvent[] {
    return events.map((event) => ({
      id: event.id,
      source: 'system' as const,
      timestamp: event.timestamp,
      type: event.type,
      room: event.room,
      guest: event.guest,
      description: event.description,
      status: event.status,
      confidence: 'high' as const,
    }));
  }

  private normalizeNightLogs(nightLogs: NightLog[]): NormalizedEvent[] {
    return nightLogs.flatMap((log, logIndex) =>
      this.parseNightLog(log, logIndex),
    );
  }

  private parseNightLog(log: NightLog, logIndex: number): NormalizedEvent[] {
    const entries = this.splitIntoEntries(log.content);
    const events: NormalizedEvent[] = [];

    entries.forEach((entry, entryIndex) => {
      const trimmed = entry.trim();
      if (!trimmed || trimmed.length < 10) return;

      const id = `log_${String(logIndex).padStart(2, '0')}${String(entryIndex + 1).padStart(2, '0')}`;
      const room = this.extractRoom(trimmed);
      const guest = this.extractGuest(trimmed);
      const type = this.classifyType(trimmed);
      const status = this.inferStatus(trimmed);
      const language = this.detectLanguage(trimmed);
      const confidence = this.assessConfidence(trimmed, room, type);

      events.push({
        id,
        source: 'night_log',
        timestamp: null,
        type,
        room,
        guest,
        description: trimmed,
        status,
        rawText: trimmed,
        ...(language && { language }),
        confidence,
      });
    });

    this.logger.info(
      {
        step: 'event-normalizer',
        nightLogDate: log.date,
        extractedCount: events.length,
      },
      'Parsed night log',
    );

    return events;
  }

  private splitIntoEntries(content: string): string[] {
    const lines = content.split('\n');
    const entries: string[] = [];
    let currentEntry = '';

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        if (currentEntry) entries.push(currentEntry);
        currentEntry = trimmed.replace(/^[-*]\s+/, '');
      } else if (
        trimmed &&
        !trimmed.startsWith('#') &&
        !trimmed.startsWith('>') &&
        !trimmed.startsWith('---')
      ) {
        if (currentEntry) {
          currentEntry += ' ' + trimmed;
        } else {
          currentEntry = trimmed;
        }
      } else {
        if (currentEntry) {
          entries.push(currentEntry);
          currentEntry = '';
        }
      }
    }
    if (currentEntry) entries.push(currentEntry);

    return entries;
  }

  private extractRoom(text: string): string | null {
    const patterns = [
      /room\s*(\d{3})/i,
      /\b(\d{3})\s+(?:aircon|leak|deposit|safe|保险箱)/i,
      /^(\d{3})\s*[—–-]/,
      /(\d{3})\s*房/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  private extractGuest(text: string): string | null {
    const patterns = [
      /(?:mr|mrs|ms|miss)\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      /guest\s+(?:in\s+\d{3}\s+)?(?:named?\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  private classifyType(text: string): string {
    const lower = text.toLowerCase();

    for (const [keyword, type] of EVENT_TYPE_KEYWORDS) {
      if (lower.includes(keyword)) return type;
    }
    return 'note';
  }

  private inferStatus(text: string): EventStatus {
    const lower = text.toLowerCase();

    for (const indicator of RESOLVED_INDICATORS) {
      if (lower.includes(indicator)) return 'resolved';
    }
    for (const indicator of UNRESOLVED_INDICATORS) {
      if (lower.includes(indicator)) return 'unresolved';
    }
    return 'pending';
  }

  private detectLanguage(text: string): string | undefined {
    const containsChineseCharacters = /[一-鿿㐀-䶿]/.test(text);
    if (containsChineseCharacters) return 'zh';
    return undefined;
  }

  private assessConfidence(
    text: string,
    room: string | null,
    type: string,
  ): 'high' | 'low' {
    if (!room && type === 'note') return 'low';
    if (text.length < 30) return 'low';
    if (text.includes("couldn't catch") || text.includes('I assume'))
      return 'low';
    return 'high';
  }
}
