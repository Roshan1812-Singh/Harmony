import { z } from 'zod';
export declare const createTrackSchema: z.ZodObject<{
    title: z.ZodString;
    albumId: z.ZodOptional<z.ZodString>;
    trackNumber: z.ZodOptional<z.ZodNumber>;
    explicit: z.ZodDefault<z.ZodBoolean>;
    license: z.ZodEnum<["CC0", "CC_BY", "CC_BY_SA", "CC_BY_NC", "PUBLIC_DOMAIN", "ROYALTY_FREE", "ARTIST_OWNED"]>;
    genreIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    sourceKey: z.ZodString;
}, "strip", z.ZodTypeAny, {
    title: string;
    explicit: boolean;
    license: "CC0" | "CC_BY" | "CC_BY_SA" | "CC_BY_NC" | "PUBLIC_DOMAIN" | "ROYALTY_FREE" | "ARTIST_OWNED";
    sourceKey: string;
    genreIds: string[];
    albumId?: string | undefined;
    trackNumber?: number | undefined;
}, {
    title: string;
    license: "CC0" | "CC_BY" | "CC_BY_SA" | "CC_BY_NC" | "PUBLIC_DOMAIN" | "ROYALTY_FREE" | "ARTIST_OWNED";
    sourceKey: string;
    albumId?: string | undefined;
    trackNumber?: number | undefined;
    explicit?: boolean | undefined;
    genreIds?: string[] | undefined;
}>;
export type CreateTrackInput = z.infer<typeof createTrackSchema>;
export declare const updateTrackSchema: z.ZodObject<Omit<{
    title: z.ZodOptional<z.ZodString>;
    albumId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    trackNumber: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    explicit: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    license: z.ZodOptional<z.ZodEnum<["CC0", "CC_BY", "CC_BY_SA", "CC_BY_NC", "PUBLIC_DOMAIN", "ROYALTY_FREE", "ARTIST_OWNED"]>>;
    genreIds: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
    sourceKey: z.ZodOptional<z.ZodString>;
}, "sourceKey">, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    albumId?: string | undefined;
    trackNumber?: number | undefined;
    explicit?: boolean | undefined;
    license?: "CC0" | "CC_BY" | "CC_BY_SA" | "CC_BY_NC" | "PUBLIC_DOMAIN" | "ROYALTY_FREE" | "ARTIST_OWNED" | undefined;
    genreIds?: string[] | undefined;
}, {
    title?: string | undefined;
    albumId?: string | undefined;
    trackNumber?: number | undefined;
    explicit?: boolean | undefined;
    license?: "CC0" | "CC_BY" | "CC_BY_SA" | "CC_BY_NC" | "PUBLIC_DOMAIN" | "ROYALTY_FREE" | "ARTIST_OWNED" | undefined;
    genreIds?: string[] | undefined;
}>;
export type UpdateTrackInput = z.infer<typeof updateTrackSchema>;
export declare const createAlbumSchema: z.ZodObject<{
    title: z.ZodString;
    releaseDate: z.ZodOptional<z.ZodDate>;
    license: z.ZodEnum<["CC0", "CC_BY", "CC_BY_SA", "CC_BY_NC", "PUBLIC_DOMAIN", "ROYALTY_FREE", "ARTIST_OWNED"]>;
    coverKey: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title: string;
    license: "CC0" | "CC_BY" | "CC_BY_SA" | "CC_BY_NC" | "PUBLIC_DOMAIN" | "ROYALTY_FREE" | "ARTIST_OWNED";
    releaseDate?: Date | undefined;
    coverKey?: string | undefined;
}, {
    title: string;
    license: "CC0" | "CC_BY" | "CC_BY_SA" | "CC_BY_NC" | "PUBLIC_DOMAIN" | "ROYALTY_FREE" | "ARTIST_OWNED";
    releaseDate?: Date | undefined;
    coverKey?: string | undefined;
}>;
export type CreateAlbumInput = z.infer<typeof createAlbumSchema>;
export declare const trackSearchSchema: z.ZodObject<{
    q: z.ZodOptional<z.ZodString>;
    artistId: z.ZodOptional<z.ZodString>;
    albumId: z.ZodOptional<z.ZodString>;
    genreId: z.ZodOptional<z.ZodString>;
    license: z.ZodOptional<z.ZodEnum<["CC0", "CC_BY", "CC_BY_SA", "CC_BY_NC", "PUBLIC_DOMAIN", "ROYALTY_FREE", "ARTIST_OWNED"]>>;
}, "strip", z.ZodTypeAny, {
    artistId?: string | undefined;
    albumId?: string | undefined;
    license?: "CC0" | "CC_BY" | "CC_BY_SA" | "CC_BY_NC" | "PUBLIC_DOMAIN" | "ROYALTY_FREE" | "ARTIST_OWNED" | undefined;
    q?: string | undefined;
    genreId?: string | undefined;
}, {
    artistId?: string | undefined;
    albumId?: string | undefined;
    license?: "CC0" | "CC_BY" | "CC_BY_SA" | "CC_BY_NC" | "PUBLIC_DOMAIN" | "ROYALTY_FREE" | "ARTIST_OWNED" | undefined;
    q?: string | undefined;
    genreId?: string | undefined;
}>;
export type TrackSearchInput = z.infer<typeof trackSearchSchema>;
//# sourceMappingURL=track.schema.d.ts.map