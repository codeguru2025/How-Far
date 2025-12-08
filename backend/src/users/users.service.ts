import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UpdateUserDto, VerifyIdentityDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get user by ID
   */
  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        driver: true,
        wallet: true,
        guardian: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        dependents: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Get user by phone
   */
  async findByPhone(phone: string) {
    return this.prisma.user.findUnique({
      where: { phone },
    });
  }

  /**
   * Update user profile
   */
  async update(userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check email uniqueness
    if (dto.email && dto.email !== user.email) {
      const emailExists = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (emailExists) {
        throw new BadRequestException('Email already in use');
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...dto,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
    });
  }

  /**
   * Submit ID verification
   */
  async verifyIdentity(userId: string, dto: VerifyIdentityDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isVerified) {
      throw new BadRequestException('User is already verified');
    }

    // In production, this would integrate with a KYC service
    // For now, we just store the ID info for admin verification
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        idNumber: dto.idNumber,
        idImage: dto.idImage,
        // Don't auto-verify - admin will verify
      },
    });
  }

  /**
   * Add guardian for minor
   */
  async addGuardian(userId: string, guardianId: string) {
    const [user, guardian] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.user.findUnique({ where: { id: guardianId } }),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!guardian) {
      throw new NotFoundException('Guardian not found');
    }

    if (!guardian.isVerified) {
      throw new BadRequestException('Guardian must be verified');
    }

    // Calculate age
    if (!user.dateOfBirth) {
      throw new BadRequestException('User date of birth required');
    }

    const age = this.calculateAge(user.dateOfBirth);
    if (age >= 18) {
      throw new BadRequestException('Only minors can have guardians');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { guardianId },
    });
  }

  /**
   * Get user's dependents (minors under their guardianship)
   */
  async getDependents(guardianId: string) {
    return this.prisma.user.findMany({
      where: { guardianId },
      select: {
        id: true,
        name: true,
        phone: true,
        dateOfBirth: true,
        isVerified: true,
      },
    });
  }

  /**
   * Delete user account
   */
  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if wallet has balance
    if (user.wallet && user.wallet.balance > 0) {
      throw new BadRequestException(
        'Please withdraw your wallet balance before deleting account',
      );
    }

    // Soft delete - just mark as inactive
    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
  }

  /**
   * Admin: Verify user identity
   */
  async adminVerifyUser(userId: string, verified: boolean) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        isVerified: verified,
        idVerifiedAt: verified ? new Date() : null,
      },
    });
  }

  /**
   * Calculate age from date of birth
   */
  private calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    let age = today.getFullYear() - dateOfBirth.getFullYear();
    const monthDiff = today.getMonth() - dateOfBirth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
      age--;
    }
    return age;
  }
}
