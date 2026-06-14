"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signedUploadResponseSchema = exports.signImageUploadSchema = exports.signAudioUploadSchema = void 0;
const zod_1 = require("zod");
const constants_1 = require("../constants");
exports.signAudioUploadSchema = zod_1.z.object({
    filename: zod_1.z.string().min(1).max(255),
    contentType: zod_1.z.enum(constants_1.ACCEPTED_AUDIO_MIME),
    size: zod_1.z.number().int().min(1).max(constants_1.MAX_AUDIO_UPLOAD_BYTES),
});
exports.signImageUploadSchema = zod_1.z.object({
    filename: zod_1.z.string().min(1).max(255),
    contentType: zod_1.z.enum(constants_1.ACCEPTED_IMAGE_MIME),
    size: zod_1.z.number().int().min(1).max(constants_1.MAX_IMAGE_UPLOAD_BYTES),
});
exports.signedUploadResponseSchema = zod_1.z.object({
    uploadUrl: zod_1.z.string().url(),
    key: zod_1.z.string(),
    expiresAt: zod_1.z.string().datetime(),
});
//# sourceMappingURL=upload.schema.js.map