"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyEmailSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.loginSchema = exports.registerSchema = exports.displayNameSchema = exports.emailSchema = exports.passwordSchema = void 0;
const zod_1 = require("zod");
/**
 * Password policy: ≥ 8 chars, ≥ 1 letter, ≥ 1 digit, ≥ 1 symbol.
 * Length cap of 72 because bcrypt silently truncates beyond that — we'd rather reject.
 */
exports.passwordSchema = zod_1.z
    .string()
    .min(8, 'Must be at least 8 characters')
    .max(72, 'Must be 72 characters or fewer')
    .regex(/[A-Za-z]/, 'Must contain a letter')
    .regex(/\d/, 'Must contain a digit')
    .regex(/[^A-Za-z0-9]/, 'Must contain a symbol');
exports.emailSchema = zod_1.z.string().email().max(254).toLowerCase().trim();
exports.displayNameSchema = zod_1.z
    .string()
    .trim()
    .min(2, 'Too short')
    .max(40, 'Too long')
    .regex(/^[\p{L}\p{N} '._-]+$/u, 'Contains invalid characters');
exports.registerSchema = zod_1.z.object({
    email: exports.emailSchema,
    password: exports.passwordSchema,
    displayName: exports.displayNameSchema,
});
exports.loginSchema = zod_1.z.object({
    email: exports.emailSchema,
    password: zod_1.z.string().min(1).max(72),
});
exports.forgotPasswordSchema = zod_1.z.object({
    email: exports.emailSchema,
});
exports.resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(10).max(256),
    password: exports.passwordSchema,
});
exports.verifyEmailSchema = zod_1.z.object({
    token: zod_1.z.string().min(10).max(256),
});
//# sourceMappingURL=auth.schema.js.map