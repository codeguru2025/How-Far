import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto, VerifyIdentityDto, AddGuardianDto } from './dto/user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  async getProfile(@CurrentUser('id') userId: string) {
    return this.usersService.findById(userId);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(userId, dto);
  }

  @Post('me/verify-identity')
  @ApiOperation({ summary: 'Submit ID verification' })
  @ApiResponse({ status: 200, description: 'Verification submitted' })
  async verifyIdentity(
    @CurrentUser('id') userId: string,
    @Body() dto: VerifyIdentityDto,
  ) {
    return this.usersService.verifyIdentity(userId, dto);
  }

  @Post('me/guardian')
  @ApiOperation({ summary: 'Add guardian for minor' })
  @ApiResponse({ status: 200, description: 'Guardian added' })
  async addGuardian(
    @CurrentUser('id') userId: string,
    @Body() dto: AddGuardianDto,
  ) {
    return this.usersService.addGuardian(userId, dto.guardianId);
  }

  @Get('me/dependents')
  @ApiOperation({ summary: 'Get dependents (minors under guardianship)' })
  @ApiResponse({ status: 200, description: 'Dependents list' })
  async getDependents(@CurrentUser('id') userId: string) {
    return this.usersService.getDependents(userId);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Delete user account' })
  @ApiResponse({ status: 200, description: 'Account deleted' })
  async deleteAccount(@CurrentUser('id') userId: string) {
    return this.usersService.deleteAccount(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUser(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
