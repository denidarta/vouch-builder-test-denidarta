import { Module } from '@nestjs/common';
import { HandoverController } from './handover.controller';
import { HandoverService } from './handover.service';
import { EventNormalizerService } from './services/event-normalizer.service';
import { ShiftGrouperService } from './services/shift-grouper.service';
import { IssueReconcilerService } from './services/issue-reconciler.service';
import { HandoverGeneratorService } from './services/handover-generator.service';
import { DataQualityService } from './services/data-quality.service';

@Module({
  controllers: [HandoverController],
  providers: [
    HandoverService,
    EventNormalizerService,
    ShiftGrouperService,
    IssueReconcilerService,
    HandoverGeneratorService,
    DataQualityService,
  ],
})
export class HandoverModule {}
