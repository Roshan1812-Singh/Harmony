/**
 * Injection token for the S3 client.
 *
 * Kept in its own module so providers that inject it (e.g. `S3Service`)
 * don't import `s3.module.ts`, which would create a circular import and
 * leave the token undefined at decoration time.
 */
export const S3_CLIENT = Symbol('S3_CLIENT');
