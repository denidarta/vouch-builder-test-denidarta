import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HandoverService } from './handover.service';
import { GenerateHandoverDto } from './dto/generate-handover.dto';

@ApiTags('handover')
@Controller('handover')
export class HandoverController {
  constructor(private readonly handoverService: HandoverService) {}

  @Post('generate')
  @ApiOperation({
    summary: 'Generate a night-shift handover for the morning manager',
  })
  @ApiResponse({ status: 201, description: 'Handover generated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  generate(@Body() dto: GenerateHandoverDto) {
    return this.handoverService.generate(dto);
  }
}
