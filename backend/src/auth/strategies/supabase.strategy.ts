import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Strategy for validating Supabase JWT tokens
 * This allows users authenticated via Supabase Auth to access the API
 */
@Injectable()
export class SupabaseStrategy extends PassportStrategy(Strategy, 'supabase') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Supabase uses the JWT secret from the project settings
      secretOrKey: configService.get('JWT_SECRET', 'super-secret-jwt-key'),
    });
  }

  async validate(payload: any) {
    // Supabase JWT payload includes 'sub' as the user ID
    const supabaseId = payload.sub;

    // Find user by Supabase ID
    let user = await this.prisma.user.findUnique({
      where: { supabaseId },
      include: {
        driver: true,
        wallet: true,
      },
    });

    // If not found by supabaseId, try to find by phone (from payload)
    if (!user && payload.phone) {
      user = await this.prisma.user.findUnique({
        where: { phone: payload.phone },
        include: {
          driver: true,
          wallet: true,
        },
      });

      // Link Supabase ID if found
      if (user && !user.supabaseId) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { supabaseId },
        });
      }
    }

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return {
      id: user.id,
      supabaseId: user.supabaseId,
      phone: user.phone,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      driver: user.driver,
      wallet: user.wallet,
    };
  }
}
