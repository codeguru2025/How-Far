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
import { PaymentMethod } from '@prisma/client';

export class TopUpWalletDto {
  @ApiProperty({ example: 10.0, minimum: 1, maximum: 1000 })
  @IsNumber()
  @Min(1)
  @Max(1000)
  amount: number;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.ECOCASH })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ description: 'Phone number for mobile money' })
  @IsString()
  @IsOptional()
  phoneNumber?: string;
}

export class PayViaQrDto {
  @ApiProperty({ description: 'QR code string' })
  @IsString()
  @IsNotEmpty()
  qrCode: string;
}

export class GenerateQrDto {
  @ApiProperty({ example: 1.0, minimum: 0.5, maximum: 100 })
  @IsNumber()
  @Min(0.5)
  @Max(100)
  amount: number;
}

export class TransferDto {
  @ApiProperty({ description: 'Recipient user ID' })
  @IsString()
  @IsNotEmpty()
  recipientId: string;

  @ApiProperty({ example: 5.0, minimum: 0.5 })
  @IsNumber()
  @Min(0.5)
  amount: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;
}

export class WalletResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  balance: number;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  lastTopUpAt: Date | null;
}

export class QrCodeResponseDto {
  @ApiProperty()
  qrCode: string;

  @ApiProperty()
  qrData: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  expiresAt: Date;
}
