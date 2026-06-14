import { z } from 'zod';
export declare const signAudioUploadSchema: z.ZodObject<{
    filename: z.ZodString;
    contentType: z.ZodEnum<[string, ...string[]]>;
    size: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    filename: string;
    contentType: string;
    size: number;
}, {
    filename: string;
    contentType: string;
    size: number;
}>;
export type SignAudioUploadInput = z.infer<typeof signAudioUploadSchema>;
export declare const signImageUploadSchema: z.ZodObject<{
    filename: z.ZodString;
    contentType: z.ZodEnum<[string, ...string[]]>;
    size: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    filename: string;
    contentType: string;
    size: number;
}, {
    filename: string;
    contentType: string;
    size: number;
}>;
export type SignImageUploadInput = z.infer<typeof signImageUploadSchema>;
export declare const signedUploadResponseSchema: z.ZodObject<{
    uploadUrl: z.ZodString;
    key: z.ZodString;
    expiresAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    expiresAt: string;
    uploadUrl: string;
    key: string;
}, {
    expiresAt: string;
    uploadUrl: string;
    key: string;
}>;
export type SignedUploadResponse = z.infer<typeof signedUploadResponseSchema>;
//# sourceMappingURL=upload.schema.d.ts.map