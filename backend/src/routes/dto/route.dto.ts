import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
  IsBoolean,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class WaypointDto {
  @ApiProperty()
  @IsNumber()
  lat: number;

  @ApiProperty()
  @IsNumber()
  lng: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;
}

export class CreateRouteDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'CBD' })
  @IsString()
  @IsNotEmpty()
  originName: string;

  @ApiProperty()
  @IsNumber()
  originLat: number;

  @ApiProperty()
  @IsNumber()
  originLng: number;

  @ApiProperty({ example: 'Chitungwiza' })
  @IsString()
  @IsNotEmpty()
  destinationName: string;

  @ApiProperty()
  @IsNumber()
  destinationLat: number;

  @ApiProperty()
  @IsNumber()
  destinationLng: number;

  @ApiProperty({ description: 'Encoded polyline string' })
  @IsString()
  @IsNotEmpty()
  polyline: string;

  @ApiPropertyOptional({ type: [WaypointDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WaypointDto)
  @IsOptional()
  waypoints?: WaypointDto[];

  @ApiPropertyOptional({ example: 25.5, description: 'Distance in km' })
  @IsNumber()
  @IsOptional()
  distance?: number;

  @ApiPropertyOptional({ example: 45, description: 'Duration in minutes' })
  @IsNumber()
  @IsOptional()
  duration?: number;

  @ApiPropertyOptional({ example: 1.5, description: 'Base fare for this route' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  baseFare?: number;
}

export class UpdateRouteDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  polyline?: string;

  @ApiPropertyOptional({ type: [WaypointDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WaypointDto)
  @IsOptional()
  waypoints?: WaypointDto[];

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  baseFare?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class NearbyRoutesDto {
  @ApiProperty()
  @IsNumber()
  lat: number;

  @ApiProperty()
  @IsNumber()
  lng: number;

  @ApiPropertyOptional({ default: 5 })
  @IsNumber()
  @IsOptional()
  radius?: number;
}
