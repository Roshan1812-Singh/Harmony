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
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { PlaylistsService } from './playlists.service';

class CreatePlaylistDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsBoolean() isPublic?: boolean;
  @IsOptional() @IsBoolean() isCollaborative?: boolean;
}
class UpdatePlaylistDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsBoolean() isPublic?: boolean;
  @IsOptional() @IsBoolean() isCollaborative?: boolean;
}
class AddTrackDto {
  @IsUUID() trackId!: string;
  @IsOptional() @IsInt() @Min(0) @Max(10_000) position?: number;
}
class ReorderDto {
  @IsInt() @Min(0) from!: number;
  @IsInt() @Min(0) to!: number;
}

@ApiTags('playlists')
@Controller('playlists')
export class PlaylistsController {
  constructor(private readonly playlists: PlaylistsService) {}

  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Get('me')
  mine(@CurrentUser() user: AuthUser) {
    return this.playlists.listForUser(user.id);
  }

  @Public()
  @Get(':id')
  byId(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.playlists.getById(id, user?.id);
  }

  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePlaylistDto) {
    return this.playlists.create(user.id, dto);
  }

  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlaylistDto,
  ) {
    return this.playlists.update(user.id, id, dto);
  }

  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.playlists.remove(user.id, id);
  }

  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Post(':id/tracks')
  addTrack(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddTrackDto,
  ) {
    return this.playlists.addTrack(user.id, id, dto.trackId, dto.position);
  }

  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Delete(':id/tracks/:trackId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeTrack(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('trackId', ParseUUIDPipe) trackId: string,
  ) {
    return this.playlists.removeTrack(user.id, id, trackId);
  }

  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Patch(':id/reorder')
  reorder(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderDto,
  ) {
    return this.playlists.reorder(user.id, id, dto.from, dto.to);
  }
}
