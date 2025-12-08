import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import {
  TopUpWalletDto,
  PayViaQrDto,
  GenerateQrDto,
  TransferDto,
} from './dto/wallet.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('wallet')
@Controller('wallet')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @ApiOperation({ summary: 'Get wallet details' })
  @ApiResponse({ status: 200, description: 'Wallet retrieved' })
  async getWallet(@CurrentUser('id') userId: string) {
    return this.walletService.getWallet(userId);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Get wallet balance' })
  @ApiResponse({ status: 200, description: 'Balance retrieved' })
  async getBalance(@CurrentUser('id') userId: string) {
    const balance = await this.walletService.getBalance(userId);
    return { balance };
  }

  @Post('top-up')
  @Roles(UserRole.PASSENGER)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Top up wallet (Passengers only)' })
  @ApiResponse({ status: 200, description: 'Top-up initiated' })
  async topUp(@CurrentUser('id') userId: string, @Body() dto: TopUpWalletDto) {
    return this.walletService.topUp(userId, dto);
  }

  @Post('generate-qr')
  @Roles(UserRole.DRIVER)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Generate QR code for payment (Drivers only)' })
  @ApiResponse({ status: 200, description: 'QR code generated' })
  async generateQr(
    @CurrentUser('id') userId: string,
    @Body() dto: GenerateQrDto,
  ) {
    return this.walletService.generateQrCode(userId, dto);
  }

  @Post('pay-qr')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.PASSENGER)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Pay via QR code scan (Passengers only)' })
  @ApiResponse({ status: 200, description: 'Payment successful' })
  async payViaQr(@CurrentUser('id') userId: string, @Body() dto: PayViaQrDto) {
    return this.walletService.payViaQr(userId, dto);
  }

  @Post('transfer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transfer to another user' })
  @ApiResponse({ status: 200, description: 'Transfer successful' })
  async transfer(@CurrentUser('id') userId: string, @Body() dto: TransferDto) {
    return this.walletService.transfer(userId, dto);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get transaction history' })
  @ApiResponse({ status: 200, description: 'Transactions retrieved' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getTransactions(
    @CurrentUser('id') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.walletService.getTransactionHistory(userId, page, limit);
  }
}
