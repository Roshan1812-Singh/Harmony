import { z } from 'zod';
import {
  ACCEPTED_AUDIO_MIME,
  ACCEPTED_IMAGE_MIME,
  MAX_AUDIO_UPLOAD_BYTES,
  MAX_IMAGE_UPLOAD_BYTES,
} from '../constants';

export const signAudioUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(ACCEPTED_AUDIO_MIME as unknown as [string, ...string[]]),
  size: z.number().int().min(1).max(MAX_AUDIO_UPLOAD_BYTES),
});
export type SignAudioUploadInput = z.infer<typeof signAudioUploadSchema>;

export const signImageUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(ACCEPTED_IMAGE_MIME as unknown as [string, ...string[]]),
  size: z.number().int().min(1).max(MAX_IMAGE_UPLOAD_BYTES),
});
export type SignImageUploadInput = z.infer<typeof signImageUploadSchema>;

export const signedUploadResponseSchema = z.object({
  uploadUrl: z.string().url(),
  key: z.string(),
  expiresAt: z.string().datetime(),
});
export type SignedUploadResponse = z.infer<typeof signedUploadResponseSchema>;
