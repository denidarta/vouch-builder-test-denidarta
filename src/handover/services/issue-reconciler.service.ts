import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { NormalizedEvent } from '../../common/types/event.interface';
import {
  ShiftGroup,
  ReconciledIssue,
} from '../../common/types/handover.interface';

@Injectable()
export class IssueReconcilerService {
  constructor(
    @InjectPinoLogger(IssueReconcilerService.name)
    private readonly logger: PinoLogger,
  ) {}

  reconcile(
    currentShift: ShiftGroup,
    priorShifts: ShiftGroup[],
  ): ReconciledIssue[] {
    const allPriorEvents = priorShifts.flatMap((s) => s.events);
    const priorThreads = this.buildThreadMap(allPriorEvents);
    const currentThreads = this.buildThreadMap(currentShift.events);
    const issues: ReconciledIssue[] = [];

    for (const [key, currentEvents] of currentThreads.entries()) {
      const priorEvents = priorThreads.get(key);
      const allEvents = [...(priorEvents || []), ...currentEvents];
      const latestEvent = currentEvents[currentEvents.length - 1];

      let status: ReconciledIssue['status'];
      let nightsOpen = 0;

      if (priorEvents && priorEvents.length > 0) {
        if (latestEvent.status === 'resolved') {
          status = 'newly_resolved';
        } else {
          status = 'still_open';
          nightsOpen = this.countNightsOpen(
            priorEvents,
            priorShifts,
            currentShift,
          );
        }
      } else {
        status = 'new_tonight';
      }

      const contradiction = this.detectContradiction(allEvents);

      issues.push({
        threadKey: key,
        status,
        category: latestEvent.type,
        room: this.findRoom(allEvents),
        guest: this.findGuest(allEvents),
        summary: latestEvent.description,
        nightsOpen,
        sourceEvents: allEvents.map((e) => e.id),
        ...(contradiction && { contradiction }),
        timeline: this.buildTimeline(allEvents, [...priorShifts, currentShift]),
      });
    }

    for (const [key, priorEvents] of priorThreads.entries()) {
      if (currentThreads.has(key)) continue;

      const latestEvent = priorEvents[priorEvents.length - 1];
      if (latestEvent.status === 'resolved') continue;

      const nightsOpen = this.countNightsOpen(
        priorEvents,
        priorShifts,
        currentShift,
      );
      const contradiction = this.detectContradiction(priorEvents);

      issues.push({
        threadKey: key,
        status: 'still_open',
        category: latestEvent.type,
        room: this.findRoom(priorEvents),
        guest: this.findGuest(priorEvents),
        summary: latestEvent.description,
        nightsOpen,
        sourceEvents: priorEvents.map((e) => e.id),
        ...(contradiction && { contradiction }),
        timeline: this.buildTimeline(priorEvents, priorShifts),
      });
    }

    this.logger.info(
      {
        step: 'issue-reconciler',
        totalIssues: issues.length,
        stillOpen: issues.filter((i) => i.status === 'still_open').length,
        newlyResolved: issues.filter((i) => i.status === 'newly_resolved')
          .length,
        newTonight: issues.filter((i) => i.status === 'new_tonight').length,
        contradictions: issues.filter((i) => i.contradiction).length,
      },
      'Reconciliation complete',
    );

    return issues;
  }

  private buildThreadKey(event: NormalizedEvent): string {
    const room = event.room || 'null';
    const type = this.normalizeType(event.type);
    return `${room}:${type}`;
  }

  private normalizeType(type: string): string {
    const aliases: Record<string, string> = {
      finance_note: 'finance',
      deposit_issue: 'deposit',
      damage_report: 'damage',
      check_in_issue: 'check_in',
      early_checkout_request: 'checkout',
      guest_message: 'guest_message',
    };
    return aliases[type] || type;
  }

  private buildThreadMap(
    events: NormalizedEvent[],
  ): Map<string, NormalizedEvent[]> {
    const map = new Map<string, NormalizedEvent[]>();
    for (const event of events) {
      const key = this.buildThreadKey(event);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    }
    return map;
  }

  private countNightsOpen(
    priorEvents: NormalizedEvent[],
    priorShifts: ShiftGroup[],
    currentShift: ShiftGroup,
  ): number {
    const firstEvent = priorEvents[0];
    if (!firstEvent.timestamp) return priorShifts.length;

    const firstDate = new Date(firstEvent.timestamp);
    const currentDate = new Date(currentShift.start);
    const diffMs = currentDate.getTime() - firstDate.getTime();
    return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  private detectContradiction(events: NormalizedEvent[]): string | undefined {
    const statuses = events.map((e) => e.status);
    const hasResolved = statuses.includes('resolved');
    const hasUnresolved = statuses.includes('unresolved');
    const hasPending = statuses.includes('pending');

    if (hasResolved && (hasUnresolved || hasPending)) {
      const resolvedEvent = events.find((e) => e.status === 'resolved');
      const conflictingEvent = events.find(
        (e) => e.status === 'unresolved' || e.status === 'pending',
      );
      return `Conflicting status: ${resolvedEvent?.id} says resolved, but ${conflictingEvent?.id} says ${conflictingEvent?.status}. Events: ${events.map((e) => e.id).join(', ')}`;
    }

    return undefined;
  }

  private findRoom(events: NormalizedEvent[]): string | null {
    for (const event of events) {
      if (event.room) return event.room;
    }
    return null;
  }

  private findGuest(events: NormalizedEvent[]): string | null {
    for (const event of events) {
      if (event.guest) return event.guest;
    }
    return null;
  }

  private buildTimeline(
    events: NormalizedEvent[],
    shifts: ShiftGroup[],
  ): { date: string; eventId: string; summary: string }[] {
    return events.map((e) => {
      const date = e.timestamp
        ? e.timestamp.split('T')[0]
        : shifts.find((s) => s.events.includes(e))?.shiftDate || 'unknown';
      return {
        date,
        eventId: e.id,
        summary: e.description.substring(0, 120),
      };
    });
  }
}
