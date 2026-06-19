import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { NormalizedEvent } from '../../common/types/event.interface';
import {
  Handover,
  DataQuality,
  DataQualityWarning,
  FlaggedEntry,
  IncompleteEntry,
} from '../../common/types/handover.interface';

const INJECTION_PATTERNS = [
  /system\s*note/i,
  /ignore\s*all/i,
  /mark\s*(it\s*)?approved/i,
  /add\s*(a\s*)?(sgd|usd|\$)\s*\d+/i,
  /goodwill\s*credit/i,
  /report\s*(the\s*)?night\s*as\s*all\s*clear/i,
];

@Injectable()
export class DataQualityService {
  constructor(
    @InjectPinoLogger(DataQualityService.name)
    private readonly logger: PinoLogger,
  ) {}

  validate(handover: Handover, allEvents: NormalizedEvent[]): DataQuality {
    const eventIds = new Set(allEvents.map((e) => e.id));
    const warnings: DataQualityWarning[] = [];
    const flaggedEntries: FlaggedEntry[] = [];
    const incompleteEntries: IncompleteEntry[] = [];

    this.checkCitationIntegrity(handover, eventIds, warnings);
    this.checkPromptInjection(allEvents, flaggedEntries);
    this.checkIncompleteEntries(allEvents, incompleteEntries);

    this.logger.info(
      {
        step: 'data-quality',
        warnings: warnings.length,
        flagged: flaggedEntries.length,
        incomplete: incompleteEntries.length,
      },
      'Grounding validation complete',
    );

    return { warnings, flaggedEntries, incompleteEntries };
  }

  private checkCitationIntegrity(
    handover: Handover,
    eventIds: Set<string>,
    warnings: DataQualityWarning[],
  ) {
    const allItems = [
      ...handover.actionRequired,
      ...handover.pending,
      ...handover.resolved,
      ...handover.fyi,
    ];

    for (const item of allItems) {
      const missingIds = item.sourceEvents.filter((id) => !eventIds.has(id));
      if (missingIds.length > 0) {
        warnings.push({
          type: 'anomaly',
          description: `Handover item "${item.summary.substring(0, 60)}" cites non-existent events: ${missingIds.join(', ')}`,
          relatedEvents: item.sourceEvents,
        });

        this.logger.warn(
          {
            step: 'data-quality',
            missingIds,
            itemSummary: item.summary.substring(0, 60),
          },
          'Citation references non-existent event',
        );
      }
    }
  }

  private checkPromptInjection(
    events: NormalizedEvent[],
    flaggedEntries: FlaggedEntry[],
  ) {
    for (const event of events) {
      if (event.type !== 'guest_message') continue;

      const matchedPatterns = INJECTION_PATTERNS.filter((p) =>
        p.test(event.description),
      );

      if (matchedPatterns.length >= 2) {
        flaggedEntries.push({
          eventId: event.id,
          reason: `Potential prompt injection: guest note contains ${matchedPatterns.length} suspicious patterns mimicking system instructions`,
          action: 'Logged verbatim for review. Not processed as system instruction.',
        });

        this.logger.warn(
          {
            step: 'data-quality',
            eventId: event.id,
            patternsMatched: matchedPatterns.length,
          },
          'Prompt injection attempt detected',
        );
      }
    }
  }

  private checkIncompleteEntries(
    events: NormalizedEvent[],
    incompleteEntries: IncompleteEntry[],
  ) {
    const actionableTypes = new Set([
      'complaint',
      'maintenance',
      'facilities',
      'deposit_issue',
      'incident',
      'compliance',
      'damage_report',
    ]);

    for (const event of events) {
      if (!actionableTypes.has(event.type)) continue;
      if (event.status === 'resolved') continue;

      const missing: string[] = [];
      if (!event.room) missing.push('room');
      if (!event.guest) missing.push('guest');
      if (!event.timestamp) missing.push('timestamp');

      if (missing.length > 0) {
        incompleteEntries.push({
          eventId: event.id,
          missing,
          note: `${event.type} event missing ${missing.join(', ')} — may limit follow-up ability`,
        });
      }
    }
  }
}
