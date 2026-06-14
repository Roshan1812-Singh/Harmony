import { Injectable, NotFoundException } from '@nestjs/common';
import type { TrackStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async platformStats() {
    const [users, artists, tracks, plays7d] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.artist.count(),
      this.prisma.track.count({ where: { deletedAt: null, status: 'READY' } }),
      this.prisma.playbackSession.count({
        where: { startedAt: { gte: new Date(Date.now() - 7 * 86400_000) } },
      }),
    ]);
    return { users, artists, tracks, plays7d };
  }

  async listUsers(q: string | undefined, limit = 50) {
    return this.prisma.user.findMany({
      where: q ? { OR: [{ email: { contains: q } }, { displayName: { contains: q } }] } : {},
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        banned: true,
        createdAt: true,
        emailVerifiedAt: true,
      },
    });
  }

  async setUserRole(actorId: string, userId: string, role: UserRole) {
    const updated = await this.prisma.user.update({ where: { id: userId }, data: { role } });
    await this.audit(actorId, 'USER_ROLE_CHANGE', 'user', userId, { role });
    return updated;
  }

  async banUser(actorId: string, userId: string, reason: string) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { banned: true, bannedReason: reason },
    });
    await this.audit(actorId, 'USER_BAN', 'user', userId, { reason });
    return updated;
  }

  async unbanUser(actorId: string, userId: string) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { banned: false, bannedReason: null },
    });
    await this.audit(actorId, 'USER_UNBAN', 'user', userId, {});
    return updated;
  }

  async setTrackStatus(actorId: string, trackId: string, status: TrackStatus) {
    const track = await this.prisma.track.findUnique({ where: { id: trackId } });
    if (!track) throw new NotFoundException('Track not found');
    const updated = await this.prisma.track.update({ where: { id: trackId }, data: { status } });
    const action =
      status === 'READY' ? 'TRACK_APPROVE' :
      status === 'REJECTED' ? 'TRACK_REJECT' :
      status === 'TAKEDOWN' ? 'TRACK_TAKEDOWN' : 'TRACK_RESTORE';
    await this.audit(actorId, action, 'track', trackId, { status });
    return updated;
  }

  async verifyArtist(actorId: string, artistId: string, verified: boolean) {
    const updated = await this.prisma.artist.update({
      where: { id: artistId },
      data: { verified },
    });
    await this.audit(actorId, 'ARTIST_VERIFY', 'artist', artistId, { verified });
    return updated;
  }

  private async audit(
    actorId: string,
    action: Parameters<PrismaService['auditLog']['create']>[0]['data']['action'],
    targetType: string,
    targetId: string,
    payload: Record<string, unknown>,
  ) {
    await this.prisma.auditLog.create({
      data: { actorId, action, targetType, targetId, payload: payload as never },
    });
  }
}
