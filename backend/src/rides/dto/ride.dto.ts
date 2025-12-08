import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsEnum,
  IsOptional,
  Min,
  Max,
} from 'class-validator';
import { RideStatus, PaymentMethod } from '@prisma/client';

export class RequestRideDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  driverId: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  routeId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  pickupName: string;

  @ApiProperty()
  @IsNumber()
  pickupLat: number;

  @ApiProperty()
  @IsNumber()
  pickupLng: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  dropoffName: string;

  @ApiProperty()
  @IsNumber()
  dropoffLat: number;

  @ApiProperty()
  @IsNumber()
  dropoffLng: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  fare: number;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;
}

export class UpdateRideStatusDto {
  @ApiProperty({ enum: RideStatus })
  @IsEnum(RideStatus)
  status: RideStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  cancelReason?: string;
}

export class RateRideDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  feedback?: string;
}

export class ShareTripDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  rideId: string;
}

export class RideFilterDto {
  @ApiPropertyOptional({ enum: RideStatus })
  @IsEnum(RideStatus)
  @IsOptional()
  status?: RideStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  endDate?: string;
}
