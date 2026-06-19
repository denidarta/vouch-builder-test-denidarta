import {
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class HotelDto {
  @ApiProperty({ example: 'lumen-sg' })
  @IsString()
  id: string;

  @ApiProperty({ example: 'Lumen Boutique Hotel' })
  @IsString()
  name: string;

  @ApiProperty({ example: 40 })
  @IsNumber()
  rooms: number;

  @ApiProperty({ example: '+08:00' })
  @IsString()
  timezone: string;
}

export class EventDto {
  @ApiProperty({ example: 'evt_0001' })
  @IsString()
  id: string;

  @ApiProperty({ example: '2026-05-25T23:14:00+08:00' })
  @IsString()
  timestamp: string;

  @ApiProperty({ example: 'check_in' })
  @IsString()
  type: string;

  @ApiProperty({ example: '204', required: false })
  @IsOptional()
  @IsString()
  room: string | null;

  @ApiProperty({ example: 'Tan Wei Ming', required: false })
  @IsOptional()
  @IsString()
  guest: string | null;

  @ApiProperty({ example: 'Late check-in, smooth.' })
  @IsString()
  description: string;

  @ApiProperty({ example: 'resolved', enum: ['resolved', 'unresolved', 'pending'] })
  @IsIn(['resolved', 'unresolved', 'pending'])
  status: 'resolved' | 'unresolved' | 'pending';
}

export class NightLogDto {
  @ApiProperty({ example: '2026-05-27' })
  @IsString()
  date: string;

  @ApiProperty({ example: 'Hi all, covering tonight...' })
  @IsString()
  content: string;
}

export class GenerateHandoverDto {
  @ApiProperty({ type: HotelDto })
  @ValidateNested()
  @Type(() => HotelDto)
  hotel: HotelDto;

  @ApiProperty({ type: [EventDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventDto)
  events: EventDto[];

  @ApiProperty({ type: [NightLogDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NightLogDto)
  nightLogs: NightLogDto[];

  @ApiProperty({ example: '2026-05-30' })
  @IsString()
  targetDate: string;
}
