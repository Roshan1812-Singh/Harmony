import { z } from 'zod';
import { LICENSES } from '../constants';

const titleSchema = z.string().trim().min(1).max(200);

export const createTrackSchema = z.object({
  title: titleSchema,
  albumId: z.string().uuid().optional(),
  trackNumber: z.number().int().min(1).max(999).optional(),
  explicit: z.boolean().default(false),
  license: z.enum(LICENSES),
  genreIds: z.array(z.string().uuid()).max(5).default([]),
  sourceKey: z.string().min(1).max(512),
});
export type CreateTrackInput = z.infer<typeof createTrackSchema>;

export const updateTrackSchema = createTrackSchema.partial().omit({ sourceKey: true });
export type UpdateTrackInput = z.infer<typeof updateTrackSchema>;

export const createAlbumSchema = z.object({
  title: titleSchema,
  releaseDate: z.coerce.date().optional(),
  license: z.enum(LICENSES),
  coverKey: z.string().max(512).optional(),
});
export type CreateAlbumInput = z.infer<typeof createAlbumSchema>;

export const trackSearchSchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  artistId: z.string().uuid().optional(),
  albumId: z.string().uuid().optional(),
  genreId: z.string().uuid().optional(),
  license: z.enum(LICENSES).optional(),
});
export type TrackSearchInput = z.infer<typeof trackSearchSchema>;
