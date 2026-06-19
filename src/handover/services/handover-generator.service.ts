import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  ReconciledIssue,
  Handover,
  HandoverItem,
} from '../../common/types/handover.interface';
import { PRIORITY_ORDER } from '../../common/constants/priority.constants';

@Injectable()
export class HandoverGeneratorService {
  constructor(
    @InjectPinoLogger(HandoverGeneratorService.name)
    private readonly logger: PinoLogger,
  ) {}

  generate(issues: ReconciledIssue[]): Handover {
    const handover: Handover = {
      actionRequired: [],
      pending: [],
      resolved: [],
      fyi: [],
    };

    for (const issue of issues) {
      const item = this.toHandoverItem(issue);
      const section = this.assignSection(issue);
      handover[section].push(item);
    }

    handover.actionRequired.sort((a, b) => a.priority - b.priority);
    handover.pending.sort((a, b) => a.priority - b.priority);

    this.logger.info(
      {
        step: 'handover-generator',
        actionRequired: handover.actionRequired.length,
        pending: handover.pending.length,
        resolved: handover.resolved.length,
        fyi: handover.fyi.length,
      },
      'Handover generated',
    );

    return handover;
  }

  private toHandoverItem(issue: ReconciledIssue): HandoverItem {
    return {
      priority: PRIORITY_ORDER[issue.category] || 99,
      category: issue.category,
      summary: issue.summary,
      details: this.buildDetails(issue),
      room: issue.room,
      guest: issue.guest,
      sourceEvents: issue.sourceEvents,
      nightsOpen: issue.nightsOpen,
      threadStatus: issue.status,
    };
  }

  private buildDetails(issue: ReconciledIssue): string {
    const parts: string[] = [];

    if (issue.nightsOpen > 0) {
      parts.push(`Open for ${issue.nightsOpen} night(s).`);
    }

    if (issue.contradiction) {
      parts.push(`WARNING: ${issue.contradiction}`);
    }

    if (issue.timeline.length > 1) {
      parts.push(
        'Timeline: ' +
          issue.timeline
            .map((t) => `${t.date}: ${t.summary}`)
            .join(' → '),
      );
    }

    return parts.join(' ');
  }

  private assignSection(issue: ReconciledIssue): keyof Handover {
    if (issue.status === 'newly_resolved') return 'resolved';

    const latestStatus = this.getLatestStatus(issue);

    if (latestStatus === 'resolved' && issue.status !== 'still_open') {
      return 'fyi';
    }

    if (latestStatus === 'unresolved') return 'actionRequired';
    if (latestStatus === 'pending') return 'pending';
    return 'fyi';
  }

  private getLatestStatus(issue: ReconciledIssue): string {
    if (issue.contradiction) return 'pending';
    return issue.status === 'still_open' ? 'unresolved' : 'resolved';
  }
}
