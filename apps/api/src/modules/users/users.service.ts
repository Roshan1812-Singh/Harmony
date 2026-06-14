import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: this.publicSelect,
    });
    if (!u) throw new NotFoundException('User not found');
    return this.toPublic(u);
  }

  async updateOwn(currentUserId: string, dto: UpdateProfileDto) {
    const updated = await this.prisma.user.update({
      where: { id: currentUserId },
      data: {
        displayName: dto.displayName,
        avatarUrl: dto.avatarUrl ?? undefined,
      },
      select: this.publicSelect,
    });
    return this.toPublic(updated);
  }

  async deleteOwn(currentUserId: string) {
    await this.prisma.user.update({
      where: { id: currentUserId },
      data: { deletedAt: new Date(), email: `deleted-${currentUserId}@harmony.local` },
    });
  }

  async follow(currentUserId: string, artistId: string) {
    const artist = await this.prisma.artist.findUnique({ where: { id: artistId } });
    if (!artist) throw new NotFoundException('Artist not found');
    if (artist.userId === currentUserId) {
      throw new ForbiddenException("You can't follow yourself");
    }
    await this.prisma.follow.upsert({
      where: { followerId_artistId: { followerId: currentUserId, artistId } },
      update: {},
      create: { followerId: currentUserId, artistId },
    });
  }

  async unfollow(currentUserId: string, artistId: string) {
    await this.prisma.follow.deleteMany({
      where: { followerId: currentUserId, artistId },
    });
  }

  async listFollowing(currentUserId: string) {
    const rows = await this.prisma.follow.findMany({
      where: { followerId: currentUserId },
      include: { artist: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((r) => r.artist);
  }

  private readonly publicSelect = {
    id: true,
    email: true,
    displayName: true,
    avatarUrl: true,
    role: true,
    emailVerifiedAt: true,
    createdAt: true,
  } as const;

  private toPublic(u: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    role: string;
    emailVerifiedAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      role: u.role,
      emailVerified: u.emailVerifiedAt !== null,
      createdAt: u.createdAt.toISOString(),
    };
  }
}
