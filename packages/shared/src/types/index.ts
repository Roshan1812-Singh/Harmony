import type { License, TrackStatus, UserRole } from '../constants';

/**
 * DTOs that flow over the wire. These are intentionally hand-written (not generated)
 * so the public API surface is decoupled from the DB schema.
 */

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  emailVerified: boolean;
  createdAt: string;
}

export interface PublicArtist {
  id: string;
  userId: string;
  displayName: string;
  slug: string;
  bio: string | null;
  coverUrl: string | null;
  verified: boolean;
  monthlyListeners: number;
}

export interface PublicAlbum {
  id: string;
  artistId: string;
  artist?: Pick<PublicArtist, 'id' | 'displayName' | 'slug'>;
  title: string;
  slug: string;
  coverUrl: string | null;
  releaseDate: string | null;
  license: License;
  trackCount?: number;
}

export interface PublicTrack {
  id: string;
  title: string;
  slug: string;
  albumId: string | null;
  artistId: string;
  artist?: Pick<PublicArtist, 'id' | 'displayName' | 'slug'>;
  album?: Pick<PublicAlbum, 'id' | 'title' | 'slug' | 'coverUrl'> | null;
  durationMs: number;
  explicit: boolean;
  license: License;
  status: TrackStatus;
  coverUrl: string | null;
  playCount: number;
  liked?: boolean;
}

export interface PublicPlaylist {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  isPublic: boolean;
  isCollaborative: boolean;
  trackCount: number;
  totalDurationMs: number;
  createdAt: string;
  updatedAt: string;
}

export interface StreamManifest {
  trackId: string;
  format: 'hls' | 'mp3';
  url: string;
  expiresAt: string;
  durationMs: number;
}

export interface ApiError {
  type: string;
  title: string;
  status: number;
  detail?: string;
  errors?: Record<string, string[]>;
}
