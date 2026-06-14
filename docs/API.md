# Harmony — API

Base URL: `https://api.harmony.example/api/v1`
OpenAPI: `https://api.harmony.example/docs` (Swagger UI) and `/docs-json` (raw spec)

## Conventions

- JSON only. `Content-Type: application/json` required for bodies.
- All errors follow [RFC 7807](https://www.rfc-editor.org/rfc/rfc7807): `{ type, title, status, detail, errors? }`.
- Pagination: cursor-based — `?cursor=<opaque>&limit=20`. Response includes `nextCursor`.
- Timestamps: ISO 8601 UTC.
- Auth: cookies (`harmony.at`, `harmony.rt`). Mutations require `x-csrf-token`.

## Selected endpoints (full list in Swagger)

### Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | `{email, password, displayName}` |
| POST | `/auth/login` | `{email, password}` → sets cookies |
| POST | `/auth/refresh` | rotates refresh token |
| POST | `/auth/logout` | revokes refresh |
| POST | `/auth/verify-email` | `{token}` |
| POST | `/auth/forgot-password` | `{email}` |
| POST | `/auth/reset-password` | `{token, password}` |
| GET  | `/auth/oauth/google` | redirects |
| GET  | `/auth/oauth/google/callback` | sets cookies |
| GET  | `/auth/oauth/github` | redirects |
| GET  | `/auth/oauth/github/callback` | sets cookies |
| GET  | `/auth/me` | current user |

### Tracks
| Method | Path |
|---|---|
| GET    | `/tracks` (filters: artistId, albumId, genreId, q) |
| GET    | `/tracks/:id` |
| POST   | `/tracks` (artist only) |
| PATCH  | `/tracks/:id` (artist or admin) |
| DELETE | `/tracks/:id` (artist or admin) |
| POST   | `/tracks/:id/like` |
| DELETE | `/tracks/:id/like` |

### Albums / Artists / Genres
Mirror the tracks shape.

### Playlists
| Method | Path |
|---|---|
| GET    | `/playlists/me` |
| POST   | `/playlists` |
| GET    | `/playlists/:id` |
| PATCH  | `/playlists/:id` |
| DELETE | `/playlists/:id` |
| POST   | `/playlists/:id/tracks` `{trackId}` |
| DELETE | `/playlists/:id/tracks/:trackId` |
| PATCH  | `/playlists/:id/reorder` `{from, to}` |

### Library
| Method | Path |
|---|---|
| GET | `/library/recently-played?limit=50` |
| GET | `/library/liked` |
| GET | `/library/following` |

### Streaming
| Method | Path | Notes |
|---|---|---|
| GET | `/stream/:trackId/manifest` | returns signed CloudFront URL + manifest type (`hls` or `mp3`) |
| POST | `/stream/heartbeat` | `{trackId, msPlayed}` — debounced server-side |

### Uploads
| Method | Path | Notes |
|---|---|---|
| POST | `/uploads/audio/sign` | `{filename, contentType, size}` → pre-signed S3 PUT |
| POST | `/uploads/image/sign` | for cover art |

### Search
| Method | Path |
|---|---|
| GET | `/search?q=...&type=track,album,artist` |
| GET | `/search/autocomplete?q=...` |

### Admin
| Method | Path |
|---|---|
| GET    | `/admin/stats` |
| GET    | `/admin/users` |
| PATCH  | `/admin/users/:id` (ban, role, verify) |
| PATCH  | `/admin/tracks/:id/moderation` (READY, REJECTED, TAKEDOWN) |
| DELETE | `/admin/tracks/:id` |

## Error codes

| Status | Meaning |
|---|---|
| 400 | Validation (`detail` enumerates fields) |
| 401 | Missing/invalid auth |
| 403 | Forbidden (RBAC) |
| 404 | Not found |
| 409 | Conflict (e.g. duplicate email) |
| 413 | Payload too large |
| 415 | Unsupported media |
| 422 | Business rule violation |
| 429 | Rate limited (`Retry-After` header) |
| 500 | Server error (Sentry id in `detail`) |
| 503 | Dependency down (DB/Redis) |
