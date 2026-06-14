/**
 * Domain-wide constants shared between the API and the web client.
 * Anything here must remain serialisable (no functions / classes).
 */

export const APP_NAME = 'Harmony';

/** Maximum audio upload size in bytes (100 MB). */
export const MAX_AUDIO_UPLOAD_BYTES = 100 * 1024 * 1024;

/** Maximum image upload size in bytes (5 MB). */
export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;

export const ACCEPTED_AUDIO_MIME = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'audio/x-flac',
  'audio/aac',
  'audio/mp4',
  'audio/ogg',
] as const;

export const ACCEPTED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Min playback duration (ms) before a play counts towards play-count. */
export const PLAYBACK_MIN_COUNT_MS = 30_000;

/** How often (ms) the web player sends a `/stream/heartbeat`. */
export const PLAYBACK_HEARTBEAT_INTERVAL_MS = 15_000;

/** Recently-played cap per user. */
export const RECENTLY_PLAYED_CAP = 100;

export const PAGINATION_DEFAULT_LIMIT = 20;
export const PAGINATION_MAX_LIMIT = 100;

export const LICENSES = [
  'CC0',
  'CC_BY',
  'CC_BY_SA',
  'CC_BY_NC',
  'PUBLIC_DOMAIN',
  'ROYALTY_FREE',
  'ARTIST_OWNED',
] as const;
export type License = (typeof LICENSES)[number];

export const TRACK_STATUSES = ['DRAFT', 'PROCESSING', 'READY', 'REJECTED', 'TAKEDOWN'] as const;
export type TrackStatus = (typeof TRACK_STATUSES)[number];

export const USER_ROLES = ['USER', 'ARTIST', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];
