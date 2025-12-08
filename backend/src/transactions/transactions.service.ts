import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateTransactionDto, TransactionFilterDto } from './dto/transaction.dto';
import { TransactionStatus } from '@prisma/client';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a transaction
   */
  async create(dto: CreateTransactionDto) {
    const fee = this.calculateFee(dto.amount, dto.type);
    const netAmount = dto.amount - fee;

    return this.prisma.transaction.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        amount: dto.amount,
        fee,
        netAmount,
        paymentMethod: dto.paymentMethod,
        reference: dto.reference,
        description: dto.description,
        status: dto.status || TransactionStatus.PENDING,
      },
    });
  }

  /**
   * Find transaction by ID
   */
  async findById(id: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }

  /**
   * Find transaction by reference
   */
  async findByReference(reference: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { reference },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }

  /**
   * Update transaction status
   */
  async updateStatus(id: string, status: TransactionStatus, externalRef?: string) {
    return this.prisma.transaction.update({
      where: { id },
      data: {
        status,
        externalRef,
      },
    });
  }

  /**
   * Get transactions for user with filters
   */
  async findByUser(userId: string, filter: TransactionFilterDto, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: any = { userId };

    if (filter.type) {
      where.type = filter.type;
    }

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) {
        where.createdAt.gte = new Date(filter.startDate);
      }
      if (filter.endDate) {
        where.createdAt.lte = new Date(filter.endDate);
      }
    }

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.transaction.count({ where }),
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

  /**
   * Get transaction summary for user
   */
  async getSummary(userId: string, startDate?: Date, endDate?: Date) {
    const where: any = { userId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [totalIn, totalOut, pending] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { ...where, amount: { gt: 0 }, status: TransactionStatus.COMPLETED },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { ...where, amount: { lt: 0 }, status: TransactionStatus.COMPLETED },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { ...where, status: TransactionStatus.PENDING },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalIn: totalIn._sum.amount || 0,
      totalOut: Math.abs(totalOut._sum.amount || 0),
      pending: pending._sum.amount || 0,
    };
  }

  /**
   * Admin: List all transactions
   */
  async listAll(filter: TransactionFilterDto, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filter.type) where.type = filter.type;
    if (filter.status) where.status = filter.status;

    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) where.createdAt.gte = new Date(filter.startDate);
      if (filter.endDate) where.createdAt.lte = new Date(filter.endDate);
    }

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, phone: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.transaction.count({ where }),
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

  /**
   * Calculate transaction fee
   */
  private calculateFee(amount: number, type: string): number {
    // Implement fee structure
    // For now, no fees
    return 0;
  }
}
