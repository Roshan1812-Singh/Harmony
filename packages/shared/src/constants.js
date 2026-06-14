"use strict";
/**
 * Domain-wide constants shared between the API and the web client.
 * Anything here must remain serialisable (no functions / classes).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.USER_ROLES = exports.TRACK_STATUSES = exports.LICENSES = exports.PAGINATION_MAX_LIMIT = exports.PAGINATION_DEFAULT_LIMIT = exports.RECENTLY_PLAYED_CAP = exports.PLAYBACK_HEARTBEAT_INTERVAL_MS = exports.PLAYBACK_MIN_COUNT_MS = exports.ACCEPTED_IMAGE_MIME = exports.ACCEPTED_AUDIO_MIME = exports.MAX_IMAGE_UPLOAD_BYTES = exports.MAX_AUDIO_UPLOAD_BYTES = exports.APP_NAME = void 0;
exports.APP_NAME = 'Harmony';
/** Maximum audio upload size in bytes (100 MB). */
exports.MAX_AUDIO_UPLOAD_BYTES = 100 * 1024 * 1024;
/** Maximum image upload size in bytes (5 MB). */
exports.MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
exports.ACCEPTED_AUDIO_MIME = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/flac',
    'audio/x-flac',
    'audio/aac',
    'audio/mp4',
    'audio/ogg',
];
exports.ACCEPTED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
/** Min playback duration (ms) before a play counts towards play-count. */
exports.PLAYBACK_MIN_COUNT_MS = 30_000;
/** How often (ms) the web player sends a `/stream/heartbeat`. */
exports.PLAYBACK_HEARTBEAT_INTERVAL_MS = 15_000;
/** Recently-played cap per user. */
exports.RECENTLY_PLAYED_CAP = 100;
exports.PAGINATION_DEFAULT_LIMIT = 20;
exports.PAGINATION_MAX_LIMIT = 100;
exports.LICENSES = [
    'CC0',
    'CC_BY',
    'CC_BY_SA',
    'CC_BY_NC',
    'PUBLIC_DOMAIN',
    'ROYALTY_FREE',
    'ARTIST_OWNED',
];
exports.TRACK_STATUSES = ['DRAFT', 'PROCESSING', 'READY', 'REJECTED', 'TAKEDOWN'];
exports.USER_ROLES = ['USER', 'ARTIST', 'ADMIN'];
//# sourceMappingURL=constants.js.map