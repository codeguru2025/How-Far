import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import {
  SendOtpDto,
  VerifyOtpDto,
  RegisterDto,
  LoginDto,
  AuthResponseDto,
} from './dto/auth.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private usersService: UsersService,
  ) {}

  /**
   * Send OTP to phone number
   */
  async sendOtp(dto: SendOtpDto): Promise<{ message: string; expiresIn: number }> {
    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    if (!user) {
      // Create temporary user record
      user = await this.prisma.user.create({
        data: {
          phone: dto.phone,
          name: 'New User',
          role: UserRole.PASSENGER,
        },
      });
    }

    // Invalidate previous OTPs
    await this.prisma.otpCode.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    // Create new OTP
    await this.prisma.otpCode.create({
      data: {
        userId: user.id,
        code,
        expiresAt,
      },
    });

    // TODO: Integrate with SMS provider (Twilio, Africa's Talking, etc.)
    // For development, log the OTP
    console.log(`📱 OTP for ${dto.phone}: ${code}`);

    return {
      message: 'OTP sent successfully',
      expiresIn: 600, // 10 minutes in seconds
    };
  }

  /**
   * Verify OTP code
   */
  async verifyOtp(dto: VerifyOtpDto): Promise<{ valid: boolean; isNewUser: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const otpRecord = await this.prisma.otpCode.findFirst({
      where: {
        userId: user.id,
        code: dto.code,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!otpRecord) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // Mark OTP as used
    await this.prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });

    // Check if user needs to complete registration
    const isNewUser = user.name === 'New User';

    return { valid: true, isNewUser };
  }

  /**
   * Register new user
   */
  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    // Check if phone already registered with complete profile
    const existingUser = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    if (existingUser && existingUser.name !== 'New User') {
      throw new ConflictException('Phone number already registered');
    }

    // Check email uniqueness
    if (dto.email) {
      const emailExists = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (emailExists) {
        throw new ConflictException('Email already registered');
      }
    }

    // Validate guardian for minors
    if (dto.dateOfBirth) {
      const age = this.calculateAge(new Date(dto.dateOfBirth));
      if (age < 18 && !dto.guardianId) {
        throw new BadRequestException('Guardian required for users under 18');
      }
    }

    let user;
    if (existingUser) {
      // Update existing temporary user
      user = await this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: dto.name,
          email: dto.email,
          role: dto.role,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          guardianId: dto.guardianId,
        },
      });
    } else {
      // Create new user
      user = await this.prisma.user.create({
        data: {
          phone: dto.phone,
          name: dto.name,
          email: dto.email,
          role: dto.role,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          guardianId: dto.guardianId,
        },
      });
    }

    // Create wallet for the user
    await this.prisma.wallet.create({
      data: { userId: user.id },
    });

    // Create driver profile if role is DRIVER
    if (dto.role === UserRole.DRIVER) {
      await this.prisma.driver.create({
        data: {
          userId: user.id,
          licenceNumber: '',
          licenceImage: '',
        },
      });
    }

    return this.generateTokens(user);
  }

  /**
   * Login user
   */
  async login(dto: LoginDto): Promise<AuthResponseDto> {
    // First verify OTP
    const { valid, isNewUser } = await this.verifyOtp({
      phone: dto.phone,
      code: dto.code,
    });

    if (!valid) {
      throw new UnauthorizedException('Invalid OTP');
    }

    if (isNewUser) {
      throw new BadRequestException('Please complete registration first');
    }

    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account not found or inactive');
    }

    return this.generateTokens(user);
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthResponseDto> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET', 'refresh-secret'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Update FCM token for push notifications
   */
  async updateFcmToken(userId: string, fcmToken: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { fcmToken },
    });
  }

  /**
   * Generate JWT tokens
   */
  private generateTokens(user: {
    id: string;
    phone: string;
    name: string;
    email: string | null;
    role: UserRole;
    isVerified: boolean;
    profilePic: string | null;
  }): AuthResponseDto {
    const payload = { sub: user.id, phone: user.phone, role: user.role };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET', 'refresh-secret'),
      expiresIn: '30d',
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        email: user.email || undefined,
        role: user.role,
        isVerified: user.isVerified,
        profilePic: user.profilePic || undefined,
      },
    };
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
