import { z } from 'zod';
import { usernameSchema } from './auth.schema';

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(48).optional(),
  handle: usernameSchema.optional(),
  location: z.string().max(80).optional(),
  bio: z.string().max(500).optional(),
  visibility: z.enum(['public', 'friends', 'private']).optional(),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(16),
    newPassword: z.string().min(8).max(128).optional(),
    password: z.string().min(8).max(128).optional(),
  })
  .refine((data) => Boolean(data.newPassword ?? data.password), {
    message: 'newPassword is required',
    path: ['newPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(16),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
