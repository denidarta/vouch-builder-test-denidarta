import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { GenerateHandoverDto } from './dto/generate-handover.dto';
import { HandoverResponse } from '../common/types/handover.interface';
import { EventNormalizerService } from './services/event-normalizer.service';
import { ShiftGrouperService } from './services/shift-grouper.service';
import { IssueReconcilerService } from './services/issue-reconciler.service';
import { HandoverGeneratorService } from './services/handover-generator.service';
import { DataQualityService } from './services/data-quality.service';

@Injectable()
export class HandoverService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly normalizer: EventNormalizerService,
    private readonly grouper: ShiftGrouperService,
    private readonly reconciler: IssueReconcilerService,
    private readonly generator: HandoverGeneratorService,
    private readonly validator: DataQualityService,
  ) {}

  generate(dto: GenerateHandoverDto): HandoverResponse {
    const correlationContext = {
      hotelId: dto.hotel.id,
      shiftDate: dto.targetDate,
    };

    this.logger.info(
      {
        ...correlationContext,
        step: 'pipeline-start',
        eventsCount: dto.events.length,
        nightLogsCount: dto.nightLogs.length,
      },
      'Starting handover generation',
    );

    const normalized = this.normalizer.normalize(dto.events, dto.nightLogs);

    const { currentShift, priorShifts } = this.grouper.groupByShift(
      normalized,
      dto.targetDate,
      dto.hotel.timezone,
    );

    const issues = this.reconciler.reconcile(currentShift, priorShifts);

    const handover = this.generator.generate(issues);

    const dataQuality = this.validator.validate(handover, normalized, issues);

    this.logger.info(
      { ...correlationContext, step: 'pipeline-complete' },
      'Handover generation complete',
    );

    return {
      hotel: { id: dto.hotel.id, name: dto.hotel.name },
      generatedAt: new Date().toISOString(),
      shiftDate: dto.targetDate,
      shiftWindow: {
        start: currentShift.start,
        end: currentShift.end,
      },
      handover,
      dataQuality,
    };
  }
}
