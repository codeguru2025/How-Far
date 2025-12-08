import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUrl,
  IsOptional,
  IsEnum,
  IsDateString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { DriverStatus, VerificationStatus } from '@prisma/client';

export class CreateDriverProfileDto {
  @ApiProperty({ example: 'DL123456789' })
  @IsString()
  @IsNotEmpty()
  licenceNumber: string;

  @ApiProperty({ description: 'URL of licence image' })
  @IsUrl()
  @IsNotEmpty()
  licenceImage: string;

  @ApiPropertyOptional({ description: 'Licence expiry date' })
  @IsDateString()
  @IsOptional()
  licenceExpiryDate?: string;
}

export class UpdateDriverProfileDto {
  @ApiPropertyOptional({ example: 'DL123456789' })
  @IsString()
  @IsOptional()
  licenceNumber?: string;

  @ApiPropertyOptional({ description: 'URL of licence image' })
  @IsUrl()
  @IsOptional()
  licenceImage?: string;

  @ApiPropertyOptional({ description: 'Licence expiry date' })
  @IsDateString()
  @IsOptional()
  licenceExpiryDate?: string;
}

export class UpdateDriverStatusDto {
  @ApiProperty({ enum: DriverStatus })
  @IsEnum(DriverStatus)
  status: DriverStatus;
}

export class SetActiveVehicleDto {
  @ApiProperty({ description: 'Vehicle ID to set as active' })
  @IsString()
  @IsNotEmpty()
  vehicleId: string;
}

export class UpdateLocationDto {
  @ApiProperty({ example: -17.8292 })
  @IsNumber()
  lat: number;

  @ApiProperty({ example: 31.0522 })
  @IsNumber()
  lng: number;

  @ApiPropertyOptional({ example: 45.5, description: 'Heading in degrees' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(360)
  heading?: number;

  @ApiPropertyOptional({ example: 30.5, description: 'Speed in km/h' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  speed?: number;

  @ApiPropertyOptional({ example: 5.0, description: 'GPS accuracy in meters' })
  @IsNumber()
  @IsOptional()
  accuracy?: number;
}

export class RateDriverDto {
  @ApiProperty({ example: 4.5, minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  feedback?: string;
}

export class DriverFilterDto {
  @ApiPropertyOptional({ enum: DriverStatus })
  @IsEnum(DriverStatus)
  @IsOptional()
  status?: DriverStatus;

  @ApiPropertyOptional({ enum: VerificationStatus })
  @IsEnum(VerificationStatus)
  @IsOptional()
  verificationStatus?: VerificationStatus;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
  minRating?: number;
}

export class NearbyDriversDto {
  @ApiProperty({ example: -17.8292 })
  @IsNumber()
  lat: number;

  @ApiProperty({ example: 31.0522 })
  @IsNumber()
  lng: number;

  @ApiPropertyOptional({ example: 5, description: 'Radius in km (default: 5)' })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(50)
  radius?: number;
}
