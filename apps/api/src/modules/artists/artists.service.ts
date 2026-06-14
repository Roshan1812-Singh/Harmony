import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { slugify } from '../../common/utils/slug';

interface CreateArtistDto {
  displayName: string;
  bio?: string;
}

@Injectable()
export class ArtistsService {
  constructor(private readonly prisma: PrismaService) {}

  async claimArtistProfile(userId: string, dto: CreateArtistDto) {
    const existing = await this.prisma.artist.findUnique({ where: { userId } });
    if (existing) throw new ConflictException('Artist profile already exists');

    let slug = slugify(dto.displayName);
    let suffix = 0;
    while (await this.prisma.artist.findUnique({ where: { slug } })) {
      suffix += 1;
      slug = `${slugify(dto.displayName)}-${suffix}`;
      if (suffix > 1000) throw new ConflictException('Unable to allocate slug');
    }

    return this.prisma.$transaction(async (tx) => {
      const artist = await tx.artist.create({
        data: {
          userId,
          displayName: dto.displayName,
          slug,
          bio: dto.bio,
        },
      });
      await tx.user.update({ where: { id: userId }, data: { role: 'ARTIST' } });
      return artist;
    });
  }

  async getBySlug(slug: string, userId?: string) {
    const artist = await this.prisma.artist.findUnique({
      where: { slug },
      include: {
        albums: {
          // Only albums that still have playable tracks, so the discography never
          // shows empty/orphaned album records (e.g. old fragmented soundtracks).
          where: { deletedAt: null, tracks: { some: { status: 'READY', deletedAt: null } } },
          orderBy: { releaseDate: 'desc' },
          take: 24,
        },
        _count: { select: { followers: true, tracks: true } },
      },
    });
    if (!artist) throw new NotFoundException('Artist not found');

    let isFollowing = false;
    if (userId) {
      const follow = await this.prisma.follow.findUnique({
        where: { followerId_artistId: { followerId: userId, artistId: artist.id } },
        select: { followerId: true },
      });
      isFollowing = !!follow;
    }
    return { ...artist, isFollowing };
  }

  async getTopTracks(artistId: string, limit = 10) {
    return this.prisma.track.findMany({
      // Credited either as the primary artist or via the track_artists join,
      // so a song shows under every artist on it (Spotify-style).
      where: {
        status: 'READY',
        deletedAt: null,
        OR: [{ artistId }, { artists: { some: { artistId } } }],
      },
      orderBy: { playCount: 'desc' },
      take: limit,
      include: {
        artist: { select: { id: true, displayName: true, slug: true } },
        album: { select: { id: true, title: true, slug: true, coverUrl: true } },
        artists: {
          orderBy: { position: 'asc' },
          select: { artist: { select: { id: true, displayName: true, slug: true } } },
        },
      },
    });
  }

  async updateOwnArtist(userId: string, artistId: string, dto: { displayName?: string; bio?: string; coverUrl?: string }) {
    const artist = await this.prisma.artist.findUnique({ where: { id: artistId } });
    if (!artist) throw new NotFoundException('Artist not found');
    if (artist.userId !== userId) throw new ForbiddenException('Not your artist profile');

    return this.prisma.artist.update({
      where: { id: artistId },
      data: {
        displayName: dto.displayName,
        bio: dto.bio,
        coverUrl: dto.coverUrl,
      },
    });
  }
}
