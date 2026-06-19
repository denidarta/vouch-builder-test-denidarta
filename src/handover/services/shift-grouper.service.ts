import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { NormalizedEvent } from '../../common/types/event.interface';
import { ShiftGroup } from '../../common/types/handover.interface';

@Injectable()
export class ShiftGrouperService {
  constructor(
    @InjectPinoLogger(ShiftGrouperService.name)
    private readonly logger: PinoLogger,
  ) {}

  groupByShift(
    events: NormalizedEvent[],
    targetDate: string,
    timezone: string,
  ): { currentShift: ShiftGroup; priorShifts: ShiftGroup[] } {
    const currentWindow = this.buildShiftWindow(targetDate, timezone);

    const shiftMap = new Map<string, ShiftGroup>();
    shiftMap.set(currentWindow.shiftDate, currentWindow);

    for (const event of events) {
      const shiftDate = this.assignToShift(event, timezone);
      if (!shiftDate) continue;

      if (!shiftMap.has(shiftDate)) {
        shiftMap.set(shiftDate, this.buildShiftWindow(shiftDate, timezone));
      }
      shiftMap.get(shiftDate)!.events.push(event);
    }

    const currentShift = shiftMap.get(currentWindow.shiftDate)!;
    const priorShifts = Array.from(shiftMap.values())
      .filter((s) => s.shiftDate !== currentWindow.shiftDate)
      .sort((a, b) => a.shiftDate.localeCompare(b.shiftDate));

    this.logger.info(
      {
        step: 'shift-grouper',
        targetDate,
        currentShiftEvents: currentShift.events.length,
        priorShiftCount: priorShifts.length,
      },
      'Events grouped by shift',
    );

    return { currentShift, priorShifts };
  }

  private buildShiftWindow(shiftDate: string, timezone: string): ShiftGroup {
    const prevDay = this.subtractOneDay(shiftDate);
    return {
      shiftDate,
      start: `${prevDay}T23:00:00${timezone}`,
      end: `${shiftDate}T07:00:00${timezone}`,
      events: [],
    };
  }

  private assignToShift(event: NormalizedEvent, timezone: string): string | null {
    if (!event.timestamp) {
      return null;
    }

    const date = new Date(event.timestamp);
    const hours = this.getHoursInTimezone(date, timezone);
    const dateStr = this.toDateString(date, timezone);

    if (hours >= 23) {
      return this.addOneDay(dateStr);
    } else if (hours < 7) {
      return dateStr;
    }

    return dateStr;
  }

  private getHoursInTimezone(date: Date, timezone: string): number {
    const offsetMatch = timezone.match(/([+-])(\d{2}):(\d{2})/);
    if (!offsetMatch) return date.getUTCHours();

    const sign = offsetMatch[1] === '+' ? 1 : -1;
    const offsetHours = parseInt(offsetMatch[2]);
    const offsetMinutes = parseInt(offsetMatch[3]);
    const totalOffsetMs = sign * (offsetHours * 60 + offsetMinutes) * 60 * 1000;

    const localTime = new Date(date.getTime() + totalOffsetMs);
    return localTime.getUTCHours();
  }

  private toDateString(date: Date, timezone: string): string {
    const offsetMatch = timezone.match(/([+-])(\d{2}):(\d{2})/);
    if (!offsetMatch) return date.toISOString().split('T')[0];

    const sign = offsetMatch[1] === '+' ? 1 : -1;
    const offsetHours = parseInt(offsetMatch[2]);
    const offsetMinutes = parseInt(offsetMatch[3]);
    const totalOffsetMs = sign * (offsetHours * 60 + offsetMinutes) * 60 * 1000;

    const localTime = new Date(date.getTime() + totalOffsetMs);
    return localTime.toISOString().split('T')[0];
  }

  private subtractOneDay(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00Z');
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().split('T')[0];
  }

  private addOneDay(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00Z');
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().split('T')[0];
  }
}
