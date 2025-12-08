import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { SettlementPeriod, SettlementStatus } from '@prisma/client';

export class CreateSettlementDto {
  @ApiProperty()
  @IsString()
  driverId: string;

  @ApiProperty({ enum: SettlementPeriod })
  @IsEnum(SettlementPeriod)
  period: SettlementPeriod;

  @ApiProperty()
  @IsDateString()
  periodStart: string;

  @ApiProperty()
  @IsDateString()
  periodEnd: string;
}

export class SettlementFilterDto {
  @ApiPropertyOptional({ enum: SettlementPeriod })
  @IsEnum(SettlementPeriod)
  @IsOptional()
  period?: SettlementPeriod;

  @ApiPropertyOptional({ enum: SettlementStatus })
  @IsEnum(SettlementStatus)
  @IsOptional()
  status?: SettlementStatus;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  endDate?: string;
}

export class ProcessSettlementDto {
  @ApiProperty({ enum: SettlementStatus })
  @IsEnum(SettlementStatus)
  status: SettlementStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reference?: string;
}
