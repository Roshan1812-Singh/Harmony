import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { TrackStatus, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';

class SetRoleDto {
  @IsEnum(UserRole) role!: UserRole;
}
class BanUserDto {
  @IsString() @MaxLength(500) reason!: string;
}
class SetTrackStatusDto {
  @IsEnum(TrackStatus) status!: TrackStatus;
}
class SetArtistVerifiedDto {
  @IsBoolean() verified!: boolean;
}

@ApiTags('admin')
@ApiCookieAuth()
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, CsrfGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  stats() {
    return this.admin.platformStats();
  }

  @Get('users')
  users(@Query('q') q?: string) {
    return this.admin.listUsers(q);
  }

  @Patch('users/:id/role')
  setRole(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetRoleDto,
  ) {
    return this.admin.setUserRole(actor.id, id, dto.role);
  }

  @Patch('users/:id/ban')
  ban(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BanUserDto,
  ) {
    return this.admin.banUser(actor.id, id, dto.reason);
  }

  @Patch('users/:id/unban')
  unban(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.unbanUser(actor.id, id);
  }

  @Patch('tracks/:id/moderation')
  moderateTrack(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetTrackStatusDto,
  ) {
    return this.admin.setTrackStatus(actor.id, id, dto.status);
  }

  @Patch('artists/:id/verify')
  verifyArtist(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetArtistVerifiedDto,
  ) {
    return this.admin.verifyArtist(actor.id, id, dto.verified);
  }
}
