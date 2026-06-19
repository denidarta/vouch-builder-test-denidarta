import { Module } from '@nestjs/common';
import { HandoverController } from './handover.controller';
import { HandoverService } from './handover.service';
import { EventNormalizerService } from './services/event-normalizer.service';
import { ShiftGrouperService } from './services/shift-grouper.service';
import { IssueReconcilerService } from './services/issue-reconciler.service';
import { HandoverGeneratorService } from './services/handover-generator.service';
import { GroundingValidatorService } from './services/grounding-validator.service';

@Module({
  controllers: [HandoverController],
  providers: [
    HandoverService,
    EventNormalizerService,
    ShiftGrouperService,
    IssueReconcilerService,
    HandoverGeneratorService,
    GroundingValidatorService,
  ],
})
export class HandoverModule {}
