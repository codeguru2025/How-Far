import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  IsUrl,
  IsDateString,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { VehicleType, VerificationStatus } from '@prisma/client';

export class CreateVehicleDto {
  @ApiProperty({ example: 'ABC 1234' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(20)
  plateNumber: string;

  @ApiProperty({ example: 'Toyota' })
  @IsString()
  @IsNotEmpty()
  make: string;

  @ApiProperty({ example: 'Hiace' })
  @IsString()
  @IsNotEmpty()
  model: string;

  @ApiProperty({ example: 2020 })
  @IsNumber()
  @Min(1990)
  @Max(new Date().getFullYear() + 1)
  year: number;

  @ApiProperty({ example: 'White' })
  @IsString()
  @IsNotEmpty()
  color: string;

  @ApiProperty({ enum: VehicleType, example: VehicleType.KOMBI })
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @ApiPropertyOptional({ example: 15 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  capacity?: number;

  @ApiProperty({ type: [String], description: 'Array of image URLs' })
  @IsArray()
  @IsUrl({}, { each: true })
  images: string[];

  @ApiPropertyOptional({ example: 'INS123456' })
  @IsString()
  @IsOptional()
  insuranceNumber?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  insuranceExpiry?: string;
}

export class UpdateVehicleDto extends PartialType(CreateVehicleDto) {}

export class VehicleFilterDto {
  @ApiPropertyOptional({ enum: VehicleType })
  @IsEnum(VehicleType)
  @IsOptional()
  vehicleType?: VehicleType;

  @ApiPropertyOptional({ enum: VerificationStatus })
  @IsEnum(VerificationStatus)
  @IsOptional()
  verificationStatus?: VerificationStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;
}

export class VerifyVehicleDto {
  @ApiProperty({ enum: VerificationStatus })
  @IsEnum(VerificationStatus)
  status: VerificationStatus;
}
