"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackSearchSchema = exports.createAlbumSchema = exports.updateTrackSchema = exports.createTrackSchema = void 0;
const zod_1 = require("zod");
const constants_1 = require("../constants");
const titleSchema = zod_1.z.string().trim().min(1).max(200);
exports.createTrackSchema = zod_1.z.object({
    title: titleSchema,
    albumId: zod_1.z.string().uuid().optional(),
    trackNumber: zod_1.z.number().int().min(1).max(999).optional(),
    explicit: zod_1.z.boolean().default(false),
    license: zod_1.z.enum(constants_1.LICENSES),
    genreIds: zod_1.z.array(zod_1.z.string().uuid()).max(5).default([]),
    sourceKey: zod_1.z.string().min(1).max(512),
});
exports.updateTrackSchema = exports.createTrackSchema.partial().omit({ sourceKey: true });
exports.createAlbumSchema = zod_1.z.object({
    title: titleSchema,
    releaseDate: zod_1.z.coerce.date().optional(),
    license: zod_1.z.enum(constants_1.LICENSES),
    coverKey: zod_1.z.string().max(512).optional(),
});
exports.trackSearchSchema = zod_1.z.object({
    q: zod_1.z.string().trim().min(1).max(120).optional(),
    artistId: zod_1.z.string().uuid().optional(),
    albumId: zod_1.z.string().uuid().optional(),
    genreId: zod_1.z.string().uuid().optional(),
    license: zod_1.z.enum(constants_1.LICENSES).optional(),
});
//# sourceMappingURL=track.schema.js.map