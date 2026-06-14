import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('users')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard, CsrfGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the current user.' })
  me(@CurrentUser() user: AuthUser) {
    return this.users.getById(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update your profile.' })
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateOwn(user.id, dto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete your account.' })
  deleteMe(@CurrentUser() user: AuthUser) {
    return this.users.deleteOwn(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Public user profile.' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.getById(id);
  }

  @Post(':id/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  follow(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) artistId: string) {
    return this.users.follow(user.id, artistId);
  }

  @Delete(':id/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  unfollow(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) artistId: string) {
    return this.users.unfollow(user.id, artistId);
  }
}
