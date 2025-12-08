import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsPhoneNumber,
  IsEmail,
  IsOptional,
  IsEnum,
  MinLength,
  MaxLength,
  IsDateString,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export class SendOtpDto {
  @ApiProperty({ example: '+263771234567', description: 'Phone number with country code' })
  @IsString()
  @IsNotEmpty()
  phone: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '+263771234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: '123456', description: '6-digit OTP code' })
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(6)
  code: string;
}

export class RegisterDto {
  @ApiProperty({ example: '+263771234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ enum: UserRole, example: UserRole.PASSENGER })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({ example: '1990-01-15', description: 'Date of birth' })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiPropertyOptional({ description: 'Guardian user ID for minors' })
  @IsString()
  @IsOptional()
  guardianId?: string;
}

export class LoginDto {
  @ApiProperty({ example: '+263771234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: '123456', description: 'OTP code' })
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty()
  user: {
    id: string;
    phone: string;
    name: string;
    email?: string;
    role: UserRole;
    isVerified: boolean;
    profilePic?: string;
  };
}

export class UpdateFcmTokenDto {
  @ApiProperty({ description: 'Firebase Cloud Messaging token' })
  @IsString()
  @IsNotEmpty()
  fcmToken: string;
}
