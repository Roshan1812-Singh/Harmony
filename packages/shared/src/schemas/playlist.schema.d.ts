import { z } from 'zod';
export declare const createPlaylistSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    isPublic: z.ZodDefault<z.ZodBoolean>;
    isCollaborative: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    isPublic: boolean;
    isCollaborative: boolean;
    description?: string | undefined;
}, {
    name: string;
    isPublic?: boolean | undefined;
    description?: string | undefined;
    isCollaborative?: boolean | undefined;
}>;
export type CreatePlaylistInput = z.infer<typeof createPlaylistSchema>;
export declare const updatePlaylistSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    isPublic: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    isCollaborative: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    isPublic?: boolean | undefined;
    description?: string | undefined;
    isCollaborative?: boolean | undefined;
}, {
    name?: string | undefined;
    isPublic?: boolean | undefined;
    description?: string | undefined;
    isCollaborative?: boolean | undefined;
}>;
export type UpdatePlaylistInput = z.infer<typeof updatePlaylistSchema>;
export declare const addTrackToPlaylistSchema: z.ZodObject<{
    trackId: z.ZodString;
    position: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    trackId: string;
    position?: number | undefined;
}, {
    trackId: string;
    position?: number | undefined;
}>;
export type AddTrackToPlaylistInput = z.infer<typeof addTrackToPlaylistSchema>;
export declare const reorderPlaylistSchema: z.ZodObject<{
    from: z.ZodNumber;
    to: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    from: number;
    to: number;
}, {
    from: number;
    to: number;
}>;
export type ReorderPlaylistInput = z.infer<typeof reorderPlaylistSchema>;
//# sourceMappingURL=playlist.schema.d.ts.map