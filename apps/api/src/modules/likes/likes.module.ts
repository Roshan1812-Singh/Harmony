import { Controller, Delete, HttpCode, HttpStatus, Module, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('tracks')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard, CsrfGuard)
@Controller('tracks')
class LikesController {
  constructor(private readonly prisma: PrismaService) {}

  @Post(':id/like')
  @HttpCode(HttpStatus.NO_CONTENT)
  async like(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) trackId: string) {
    await this.prisma.like.upsert({
      where: { userId_trackId: { userId: user.id, trackId } },
      update: {},
      create: { userId: user.id, trackId },
    });
  }

  @Delete(':id/like')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlike(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) trackId: string) {
    await this.prisma.like.deleteMany({ where: { userId: user.id, trackId } });
  }
}

@Module({ controllers: [LikesController] })
export class LikesModule {}
