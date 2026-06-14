"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginatedResponse = exports.idParamSchema = exports.paginationSchema = void 0;
const zod_1 = require("zod");
const constants_1 = require("../constants");
exports.paginationSchema = zod_1.z.object({
    cursor: zod_1.z.string().optional(),
    limit: zod_1.z.coerce
        .number()
        .int()
        .min(1)
        .max(constants_1.PAGINATION_MAX_LIMIT)
        .default(constants_1.PAGINATION_DEFAULT_LIMIT),
});
exports.idParamSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
});
/**
 * Generic paginated response shape. Returned as `{ data, nextCursor }`.
 * Using cursor pagination because it is stable under inserts (no off-by-one drift).
 */
const paginatedResponse = (item) => zod_1.z.object({
    data: zod_1.z.array(item),
    nextCursor: zod_1.z.string().nullable(),
});
exports.paginatedResponse = paginatedResponse;
//# sourceMappingURL=common.schema.js.map