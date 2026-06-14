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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { TracksService } from './tracks.service';
import { CreateTrackDto, UpdateTrackDto } from './dto/create-track.dto';
import { PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT } from '@harmony/shared';

@ApiTags('tracks')
@Controller('tracks')
export class TracksController {
  constructor(private readonly tracks: TracksService) {}

  @Public()
  @Get()
  list(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('artistId') artistId?: string,
    @Query('albumId') albumId?: string,
    @Query('genreId') genreId?: string,
  ) {
    return this.tracks.listPublic({
      cursor,
      limit: Math.min(Number(limit) || PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT),
      artistId,
      albumId,
      genreId,
    });
  }

  @Public()
  @Get('trending')
  trending(@Query('limit') limit?: string) {
    return this.tracks.trending(
      Math.min(Number(limit) || PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT),
    );
  }

  @Public()
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.tracks.getById(id);
  }

  @Public()
  @Get(':id/lyrics')
  lyrics(@Param('id', ParseUUIDPipe) id: string) {
    return this.tracks.getLyrics(id);
  }

  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, CsrfGuard)
  @Roles('ARTIST', 'ADMIN')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTrackDto) {
    return this.tracks.create(user.id, dto);
  }

  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, CsrfGuard)
  @Roles('ARTIST', 'ADMIN')
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTrackDto,
  ) {
    return this.tracks.update(id, user.id, user.role, dto);
  }

  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, CsrfGuard)
  @Roles('ARTIST', 'ADMIN')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.tracks.softDelete(id, user.id, user.role);
  }
}
