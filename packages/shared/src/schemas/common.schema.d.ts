import { z } from 'zod';
export declare const paginationSchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    cursor?: string | undefined;
}, {
    cursor?: string | undefined;
    limit?: number | undefined;
}>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export declare const idParamSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
/**
 * Generic paginated response shape. Returned as `{ data, nextCursor }`.
 * Using cursor pagination because it is stable under inserts (no off-by-one drift).
 */
export declare const paginatedResponse: <T extends z.ZodTypeAny>(item: T) => z.ZodObject<{
    data: z.ZodArray<T, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    data: T["_output"][];
    nextCursor: string | null;
}, {
    data: T["_input"][];
    nextCursor: string | null;
}>;
//# sourceMappingURL=common.schema.d.ts.map