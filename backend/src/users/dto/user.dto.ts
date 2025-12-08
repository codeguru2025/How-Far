import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  MinLength,
  MaxLength,
  IsUrl,
  IsDateString,
} from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsUrl()
  @IsOptional()
  profilePic?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;
}

export class VerifyIdentityDto {
  @ApiProperty({ description: 'National ID number' })
  @IsString()
  @IsNotEmpty()
  idNumber: string;

  @ApiProperty({ description: 'URL of ID image' })
  @IsUrl()
  @IsNotEmpty()
  idImage: string;
}

export class AddGuardianDto {
  @ApiProperty({ description: 'Guardian user ID' })
  @IsString()
  @IsNotEmpty()
  guardianId: string;
}

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  phone: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  email?: string;

  @ApiProperty()
  role: string;

  @ApiProperty()
  isVerified: boolean;

  @ApiPropertyOptional()
  profilePic?: string;

  @ApiPropertyOptional()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  guardianId?: string;

  @ApiProperty()
  createdAt: Date;
}
