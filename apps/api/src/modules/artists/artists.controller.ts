import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ArtistsService } from './artists.service';

class ClaimArtistDto {
  @IsString() @MinLength(2) @MaxLength(60) displayName!: string;
  @IsOptional() @IsString() @MaxLength(2000) bio?: string;
}

class UpdateArtistDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(60) displayName?: string;
  @IsOptional() @IsString() @MaxLength(2000) bio?: string;
  @IsOptional() @IsUrl() coverUrl?: string;
}

@ApiTags('artists')
@Controller('artists')
export class ArtistsController {
  constructor(private readonly artists: ArtistsService) {}

  @Public()
  @Get(':slug')
  bySlug(@Param('slug') slug: string, @CurrentUser() user?: AuthUser) {
    return this.artists.getBySlug(slug, user?.id);
  }

  @Public()
  @Get(':id/top-tracks')
  top(@Param('id') id: string) {
    return this.artists.getTopTracks(id);
  }

  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Post()
  claim(@CurrentUser() user: AuthUser, @Body() dto: ClaimArtistDto) {
    return this.artists.claimArtistProfile(user.id, dto);
  }

  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateArtistDto,
  ) {
    return this.artists.updateOwnArtist(user.id, id, dto);
  }
}
