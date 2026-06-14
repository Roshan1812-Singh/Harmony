import { Module } from '@nestjs/common';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { LICENSES, type License } from '@harmony/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { slugify } from '../../common/utils/slug';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ForbiddenException } from '@nestjs/common';

class CreateAlbumDto {
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @IsEnum(LICENSES) license!: License;
  @IsOptional() @IsString() releaseDate?: string;
  @IsOptional() @IsString() coverUrl?: string;
}

@ApiTags('albums')
@Controller('albums')
class AlbumsController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async list(@Query('artistId') artistId?: string) {
    return this.prisma.album.findMany({
      where: {
        deletedAt: null,
        ...(artistId && { artistId }),
        tracks: { some: { status: 'READY', deletedAt: null } },
      },
      orderBy: { releaseDate: 'desc' },
      take: 50,
      include: { artist: { select: { id: true, displayName: true, slug: true } } },
    });
  }

  @Public()
  @Get(':id')
  async byId(@Param('id', ParseUUIDPipe) id: string) {
    return this.prisma.album.findUniqueOrThrow({
      where: { id, deletedAt: null },
      include: {
        artist: true,
        tracks: {
          where: { status: 'READY', deletedAt: null },
          orderBy: [{ trackNumber: 'asc' }, { createdAt: 'asc' }],
          include: {
            genres: { include: { genre: true } },
            artists: {
              orderBy: { position: 'asc' },
              select: { artist: { select: { id: true, displayName: true, slug: true } } },
            },
          },
        },
      },
    });
  }

  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, CsrfGuard)
  @Roles('ARTIST', 'ADMIN')
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateAlbumDto) {
    const artist = await this.prisma.artist.findUnique({ where: { userId: user.id } });
    if (!artist) throw new ForbiddenException('Artist profile required');
    return this.prisma.album.create({
      data: {
        title: dto.title,
        slug: slugify(dto.title),
        license: dto.license,
        releaseDate: dto.releaseDate ? new Date(dto.releaseDate) : null,
        coverUrl: dto.coverUrl,
        artist: { connect: { id: artist.id } },
      },
    });
  }
}

@Module({ controllers: [AlbumsController] })
export class AlbumsModule {}
