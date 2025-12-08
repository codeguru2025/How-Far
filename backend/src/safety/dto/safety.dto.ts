import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsEnum,
  IsOptional,
  IsArray,
  IsUrl,
} from 'class-validator';
import { SafetyReportType, ReportStatus } from '@prisma/client';

export class CreateSafetyReportDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  targetId: string;

  @ApiProperty({ enum: SafetyReportType })
  @IsEnum(SafetyReportType)
  type: SafetyReportType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsUrl({}, { each: true })
  @IsOptional()
  evidence?: string[];

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  lat?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  lng?: number;
}

export class TriggerSosDto {
  @ApiProperty()
  @IsNumber()
  lat: number;

  @ApiProperty()
  @IsNumber()
  lng: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  rideId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  message?: string;
}

export class ResolveReportDto {
  @ApiProperty({ enum: ReportStatus })
  @IsEnum(ReportStatus)
  status: ReportStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  resolution?: string;
}

export class SafetyFilterDto {
  @ApiPropertyOptional({ enum: SafetyReportType })
  @IsEnum(SafetyReportType)
  @IsOptional()
  type?: SafetyReportType;

  @ApiPropertyOptional({ enum: ReportStatus })
  @IsEnum(ReportStatus)
  @IsOptional()
  status?: ReportStatus;
}
