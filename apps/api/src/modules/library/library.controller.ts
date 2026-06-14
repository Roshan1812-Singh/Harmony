import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { LibraryService } from './library.service';
import { PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT } from '@harmony/shared';

@ApiTags('users')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard, CsrfGuard)
@Controller('library')
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get('recently-played')
  recent(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    return this.library.listRecentlyPlayed(user.id, Math.min(Number(limit) || 50, 100));
  }

  @Get('liked')
  liked(
    @CurrentUser() user: AuthUser,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.library.listLiked(
      user.id,
      cursor,
      Math.min(Number(limit) || PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT),
    );
  }
}
