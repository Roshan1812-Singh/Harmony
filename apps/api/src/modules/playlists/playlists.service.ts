import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

interface CreatePlaylistInput {
  name: string;
  description?: string;
  isPublic?: boolean;
  isCollaborative?: boolean;
}

@Injectable()
export class PlaylistsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreatePlaylistInput) {
    return this.prisma.playlist.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        isPublic: dto.isPublic ?? true,
        isCollaborative: dto.isCollaborative ?? false,
      },
    });
  }

  async update(userId: string, id: string, dto: Partial<CreatePlaylistInput>) {
    await this.assertOwnerOrCollaborator(userId, id, /*requireOwner=*/ true);
    return this.prisma.playlist.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        isPublic: dto.isPublic,
        isCollaborative: dto.isCollaborative,
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.assertOwnerOrCollaborator(userId, id, /*requireOwner=*/ true);
    await this.prisma.playlist.delete({ where: { id } });
  }

  async listForUser(userId: string) {
    const rows = await this.prisma.playlist.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { items: true } } },
    });
    return rows.map((r) => ({
      ...r,
      trackCount: r._count.items,
    }));
  }

  async getById(id: string, viewerId?: string) {
    const p = await this.prisma.playlist.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: {
            track: {
              include: {
                artist: { select: { id: true, displayName: true, slug: true } },
                album: { select: { id: true, title: true, slug: true, coverUrl: true } },
                artists: {
                  orderBy: { position: 'asc' },
                  select: { artist: { select: { id: true, displayName: true, slug: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!p) throw new NotFoundException('Playlist not found');
    if (!p.isPublic && p.userId !== viewerId) throw new ForbiddenException('Private playlist');
    return p;
  }

  async addTrack(userId: string, playlistId: string, trackId: string, position?: number) {
    const pl = await this.assertOwnerOrCollaborator(userId, playlistId, /*requireOwner=*/ false);
    const count = await this.prisma.playlistTrack.count({ where: { playlistId: pl.id } });
    const pos = position ?? count;

    return this.prisma.$transaction(async (tx) => {
      // Shift positions ≥ pos to make room.
      if (pos < count) {
        await tx.$executeRaw`
          UPDATE "playlist_tracks"
          SET "position" = "position" + 1
          WHERE "playlistId" = ${pl.id}::uuid AND "position" >= ${pos}`;
      }
      await tx.playlistTrack.create({
        data: { playlistId: pl.id, trackId, position: pos, addedById: userId },
      });
      await tx.playlist.update({ where: { id: pl.id }, data: { updatedAt: new Date() } });
    });
  }

  async removeTrack(userId: string, playlistId: string, trackId: string) {
    const pl = await this.assertOwnerOrCollaborator(userId, playlistId, /*requireOwner=*/ false);
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.playlistTrack.findFirst({
        where: { playlistId: pl.id, trackId },
      });
      if (!row) return;
      await tx.playlistTrack.delete({
        where: { playlistId_position: { playlistId: pl.id, position: row.position } },
      });
      // Close the gap.
      await tx.$executeRaw`
        UPDATE "playlist_tracks"
        SET "position" = "position" - 1
        WHERE "playlistId" = ${pl.id}::uuid AND "position" > ${row.position}`;
    });
  }

  async reorder(userId: string, playlistId: string, from: number, to: number) {
    const pl = await this.assertOwnerOrCollaborator(userId, playlistId, /*requireOwner=*/ false);
    if (from === to) return;
    return this.prisma.$transaction(async (tx) => {
      const moving = await tx.playlistTrack.findUnique({
        where: { playlistId_position: { playlistId: pl.id, position: from } },
      });
      if (!moving) throw new NotFoundException('Position not found');
      // Step out to a sentinel position to avoid PK conflicts.
      await tx.playlistTrack.update({
        where: { playlistId_position: { playlistId: pl.id, position: from } },
        data: { position: -1 },
      });
      if (from < to) {
        await tx.$executeRaw`
          UPDATE "playlist_tracks"
          SET "position" = "position" - 1
          WHERE "playlistId" = ${pl.id}::uuid AND "position" > ${from} AND "position" <= ${to}`;
      } else {
        await tx.$executeRaw`
          UPDATE "playlist_tracks"
          SET "position" = "position" + 1
          WHERE "playlistId" = ${pl.id}::uuid AND "position" >= ${to} AND "position" < ${from}`;
      }
      await tx.playlistTrack.update({
        where: { playlistId_position: { playlistId: pl.id, position: -1 } },
        data: { position: to },
      });
    });
  }

  private async assertOwnerOrCollaborator(userId: string, playlistId: string, requireOwner: boolean) {
    const pl = await this.prisma.playlist.findUnique({ where: { id: playlistId } });
    if (!pl) throw new NotFoundException('Playlist not found');
    const isOwner = pl.userId === userId;
    if (requireOwner && !isOwner) throw new ForbiddenException('Owner only');
    if (!isOwner && !pl.isCollaborative) throw new ForbiddenException('Not authorised');
    return pl;
  }
}
