"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reorderPlaylistSchema = exports.addTrackToPlaylistSchema = exports.updatePlaylistSchema = exports.createPlaylistSchema = void 0;
const zod_1 = require("zod");
exports.createPlaylistSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(120),
    description: zod_1.z.string().trim().max(500).optional(),
    isPublic: zod_1.z.boolean().default(true),
    isCollaborative: zod_1.z.boolean().default(false),
});
exports.updatePlaylistSchema = exports.createPlaylistSchema.partial();
exports.addTrackToPlaylistSchema = zod_1.z.object({
    trackId: zod_1.z.string().uuid(),
    position: zod_1.z.number().int().min(0).optional(),
});
exports.reorderPlaylistSchema = zod_1.z.object({
    from: zod_1.z.number().int().min(0),
    to: zod_1.z.number().int().min(0),
});
//# sourceMappingURL=playlist.schema.js.map