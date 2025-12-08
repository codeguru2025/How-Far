import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import {
  TopUpWalletDto,
  PayViaQrDto,
  GenerateQrDto,
  TransferDto,
} from './dto/wallet.dto';
import { TransactionType, TransactionStatus, PaymentMethod, UserRole } from '@prisma/client';
import * as QRCode from 'qrcode';
import { v4 as uuid } from 'uuid';

@Injectable()
export class WalletService {
  constructor(
    private prisma: PrismaService,
    private transactionsService: TransactionsService,
  ) {}

  /**
   * Get wallet for user
   */
  async getWallet(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      // Create wallet if it doesn't exist
      return this.prisma.wallet.create({
        data: { userId },
      });
    }

    return wallet;
  }

  /**
   * Get wallet balance
   */
  async getBalance(userId: string): Promise<number> {
    const wallet = await this.getWallet(userId);
    return wallet.balance;
  }

  /**
   * Top up wallet
   */
  async topUp(userId: string, dto: TopUpWalletDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Drivers cannot top up - they only receive payments
    if (user.role === UserRole.DRIVER) {
      throw new ForbiddenException('Drivers cannot top up wallet');
    }

    const wallet = await this.getWallet(userId);

    // Create pending transaction
    const reference = `TOP-${Date.now()}-${uuid().substring(0, 8)}`;

    const transaction = await this.transactionsService.create({
      userId,
      type: TransactionType.TOP_UP,
      amount: dto.amount,
      paymentMethod: dto.paymentMethod,
      reference,
      description: `Wallet top-up via ${dto.paymentMethod}`,
    });

    // TODO: Integrate with actual payment providers
    // For now, simulate successful payment

    // Process payment based on method
    if (dto.paymentMethod === PaymentMethod.ECOCASH || dto.paymentMethod === PaymentMethod.INNBUCKS) {
      // Simulate mobile money prompt
      console.log(`📱 Mobile money prompt sent to ${dto.phoneNumber || user.phone}`);
      
      // In production, you would:
      // 1. Call payment provider API
      // 2. Wait for webhook callback
      // 3. Update transaction status

      // Simulating successful payment
      await this.processTopUp(userId, transaction.id);
    } else if (dto.paymentMethod === PaymentMethod.BANK_TRANSFER) {
      // Return pending status with bank details
      return {
        transaction,
        message: 'Please complete the bank transfer',
        bankDetails: {
          bankName: 'Sample Bank',
          accountNumber: '1234567890',
          accountName: 'RidePass Ltd',
          reference: reference,
        },
      };
    }

    return this.transactionsService.findById(transaction.id);
  }

  /**
   * Process successful top-up
   */
  async processTopUp(userId: string, transactionId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction || transaction.userId !== userId) {
      throw new NotFoundException('Transaction not found');
    }

    if (transaction.status !== TransactionStatus.PENDING) {
      throw new BadRequestException('Transaction already processed');
    }

    // Update wallet balance
    await this.prisma.wallet.update({
      where: { userId },
      data: {
        balance: { increment: transaction.amount },
        lastTopUpAt: new Date(),
      },
    });

    // Update transaction status
    return this.transactionsService.updateStatus(transactionId, TransactionStatus.COMPLETED);
  }

  /**
   * Generate QR code for payment (Driver)
   */
  async generateQrCode(userId: string, dto: GenerateQrDto) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    const qrCode = `QR-${Date.now()}-${uuid().substring(0, 8)}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const qrData = JSON.stringify({
      type: 'RIDEPASS_PAYMENT',
      qrCode,
      driverId: driver.id,
      amount: dto.amount,
      expiresAt: expiresAt.toISOString(),
    });

    // Generate QR code image as data URL
    const qrImageUrl = await QRCode.toDataURL(qrData);

    // Save QR session
    await this.prisma.qrPaymentSession.create({
      data: {
        driverId: driver.id,
        amount: dto.amount,
        qrCode,
        qrData,
        expiresAt,
      },
    });

    return {
      qrCode,
      qrData: qrImageUrl,
      amount: dto.amount,
      expiresAt,
    };
  }

  /**
   * Pay via QR code scan (Passenger)
   */
  async payViaQr(userId: string, dto: PayViaQrDto) {
    // Parse QR data
    let qrContent: any;
    try {
      qrContent = JSON.parse(dto.qrCode);
    } catch {
      // Try to find by QR code string
      const session = await this.prisma.qrPaymentSession.findUnique({
        where: { qrCode: dto.qrCode },
      });

      if (!session) {
        throw new BadRequestException('Invalid QR code');
      }

      qrContent = {
        qrCode: session.qrCode,
        driverId: session.driverId,
        amount: session.amount,
        expiresAt: session.expiresAt.toISOString(),
      };
    }

    // Validate QR session
    const session = await this.prisma.qrPaymentSession.findUnique({
      where: { qrCode: qrContent.qrCode },
      include: {
        driver: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!session) {
      throw new BadRequestException('Invalid or expired QR code');
    }

    if (session.isUsed) {
      throw new BadRequestException('QR code already used');
    }

    if (new Date() > session.expiresAt) {
      throw new BadRequestException('QR code has expired');
    }

    // Check passenger's wallet balance
    const passengerWallet = await this.getWallet(userId);

    if (passengerWallet.balance < session.amount) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    // Process payment
    const reference = `PAY-${Date.now()}-${uuid().substring(0, 8)}`;

    // Deduct from passenger's wallet
    await this.prisma.wallet.update({
      where: { userId },
      data: { balance: { decrement: session.amount } },
    });

    // Credit to driver's wallet
    const driverWallet = await this.getWallet(session.driver.userId);
    await this.prisma.wallet.update({
      where: { id: driverWallet.id },
      data: { balance: { increment: session.amount } },
    });

    // Create transactions for both parties
    await Promise.all([
      // Passenger debit
      this.transactionsService.create({
        userId,
        type: TransactionType.PAYMENT,
        amount: -session.amount,
        paymentMethod: PaymentMethod.WALLET,
        reference: `${reference}-DEBIT`,
        description: `Payment to ${session.driver.user.name}`,
        status: TransactionStatus.COMPLETED,
      }),
      // Driver credit
      this.transactionsService.create({
        userId: session.driver.userId,
        type: TransactionType.PAYMENT,
        amount: session.amount,
        paymentMethod: PaymentMethod.WALLET,
        reference: `${reference}-CREDIT`,
        description: `Payment from passenger`,
        status: TransactionStatus.COMPLETED,
      }),
    ]);

    // Mark QR as used
    await this.prisma.qrPaymentSession.update({
      where: { id: session.id },
      data: {
        isUsed: true,
        usedBy: userId,
        usedAt: new Date(),
      },
    });

    // Update driver's total earnings
    await this.prisma.driver.update({
      where: { id: session.driverId },
      data: { totalEarnings: { increment: session.amount } },
    });

    return {
      success: true,
      amount: session.amount,
      driverName: session.driver.user.name,
      reference,
    };
  }

  /**
   * Transfer between users
   */
  async transfer(userId: string, dto: TransferDto) {
    if (userId === dto.recipientId) {
      throw new BadRequestException('Cannot transfer to yourself');
    }

    const [sender, recipient] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.user.findUnique({ where: { id: dto.recipientId } }),
    ]);

    if (!sender || !recipient) {
      throw new NotFoundException('User not found');
    }

    const senderWallet = await this.getWallet(userId);

    if (senderWallet.balance < dto.amount) {
      throw new BadRequestException('Insufficient balance');
    }

    const reference = `TRF-${Date.now()}-${uuid().substring(0, 8)}`;

    // Deduct from sender
    await this.prisma.wallet.update({
      where: { userId },
      data: { balance: { decrement: dto.amount } },
    });

    // Credit to recipient
    const recipientWallet = await this.getWallet(dto.recipientId);
    await this.prisma.wallet.update({
      where: { id: recipientWallet.id },
      data: { balance: { increment: dto.amount } },
    });

    // Create transactions
    await Promise.all([
      this.transactionsService.create({
        userId,
        type: TransactionType.PAYMENT,
        amount: -dto.amount,
        paymentMethod: PaymentMethod.WALLET,
        reference: `${reference}-DEBIT`,
        description: dto.description || `Transfer to ${recipient.name}`,
        status: TransactionStatus.COMPLETED,
      }),
      this.transactionsService.create({
        userId: dto.recipientId,
        type: TransactionType.PAYMENT,
        amount: dto.amount,
        paymentMethod: PaymentMethod.WALLET,
        reference: `${reference}-CREDIT`,
        description: dto.description || `Transfer from ${sender.name}`,
        status: TransactionStatus.COMPLETED,
      }),
    ]);

    return {
      success: true,
      amount: dto.amount,
      recipientName: recipient.name,
      reference,
    };
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.transaction.count({ where: { userId } }),
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
