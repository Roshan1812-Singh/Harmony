import { z } from 'zod';

export const createPlaylistSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  isPublic: z.boolean().default(true),
  isCollaborative: z.boolean().default(false),
});
export type CreatePlaylistInput = z.infer<typeof createPlaylistSchema>;

export const updatePlaylistSchema = createPlaylistSchema.partial();
export type UpdatePlaylistInput = z.infer<typeof updatePlaylistSchema>;

export const addTrackToPlaylistSchema = z.object({
  trackId: z.string().uuid(),
  position: z.number().int().min(0).optional(),
});
export type AddTrackToPlaylistInput = z.infer<typeof addTrackToPlaylistSchema>;

export const reorderPlaylistSchema = z.object({
  from: z.number().int().min(0),
  to: z.number().int().min(0),
});
export type ReorderPlaylistInput = z.infer<typeof reorderPlaylistSchema>;
