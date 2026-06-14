/**
 * Name of the BullMQ queue used for audio transcoding.
 *
 * Kept in its own module so `TracksService` and `TranscodingProcessor`
 * don't import `tracks.module.ts` (which imports them back) — a circular
 * import would leave this constant undefined at decoration time, causing
 * `@InjectQueue`/`@Processor` to fall back to the wrong queue token.
 */
export const TRANSCODE_QUEUE = 'transcode';
