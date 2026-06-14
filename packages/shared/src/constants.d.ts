/**
 * Domain-wide constants shared between the API and the web client.
 * Anything here must remain serialisable (no functions / classes).
 */
export declare const APP_NAME = "Harmony";
/** Maximum audio upload size in bytes (100 MB). */
export declare const MAX_AUDIO_UPLOAD_BYTES: number;
/** Maximum image upload size in bytes (5 MB). */
export declare const MAX_IMAGE_UPLOAD_BYTES: number;
export declare const ACCEPTED_AUDIO_MIME: readonly ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/flac", "audio/x-flac", "audio/aac", "audio/mp4", "audio/ogg"];
export declare const ACCEPTED_IMAGE_MIME: readonly ["image/jpeg", "image/png", "image/webp"];
/** Min playback duration (ms) before a play counts towards play-count. */
export declare const PLAYBACK_MIN_COUNT_MS = 30000;
/** How often (ms) the web player sends a `/stream/heartbeat`. */
export declare const PLAYBACK_HEARTBEAT_INTERVAL_MS = 15000;
/** Recently-played cap per user. */
export declare const RECENTLY_PLAYED_CAP = 100;
export declare const PAGINATION_DEFAULT_LIMIT = 20;
export declare const PAGINATION_MAX_LIMIT = 100;
export declare const LICENSES: readonly ["CC0", "CC_BY", "CC_BY_SA", "CC_BY_NC", "PUBLIC_DOMAIN", "ROYALTY_FREE", "ARTIST_OWNED"];
export type License = (typeof LICENSES)[number];
export declare const TRACK_STATUSES: readonly ["DRAFT", "PROCESSING", "READY", "REJECTED", "TAKEDOWN"];
export type TrackStatus = (typeof TRACK_STATUSES)[number];
export declare const USER_ROLES: readonly ["USER", "ARTIST", "ADMIN"];
export type UserRole = (typeof USER_ROLES)[number];
//# sourceMappingURL=constants.d.ts.map