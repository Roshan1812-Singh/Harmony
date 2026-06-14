import { Module } from '@nestjs/common';
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

@ApiTags('tracks')
@Controller('genres')
class GenresController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  list() {
    // Only genres that still have at least one playable track, so browse tiles
    // never open an empty page (many legacy genres were emptied when previews retired).
    return this.prisma.genre.findMany({
      where: { tracks: { some: { track: { deletedAt: null, status: 'READY' } } } },
      orderBy: { name: 'asc' },
    });
  }
}

@Module({ controllers: [GenresController] })
export class GenresModule {}
