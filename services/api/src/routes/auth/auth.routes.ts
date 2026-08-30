import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../../db/client.js";
import { users, refreshTokens, passwordResetTokens, userProgress } from "../../db/schema/users.js";
import { createUser, getUserByEmail, toPublicUser } from "../../repositories/user.repo.js";
import { registerSchema, loginSchema } from "@clashofcode/shared";

// Helper function to generate a secure random hex token
const generateSecureToken = () => crypto.randomBytes(32).toString("hex");

// Helper function to generate SHA-256 hash of a token
const hashSecureToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/signup", async (request, reply) => {
    try {
      const data = registerSchema.parse(request.body);
      const normalizedEmail = data.email.trim().toLowerCase();

      // Check if user already exists
      const existingUser = await getUserByEmail(normalizedEmail);
      if (existingUser) {
        return reply.code(409).send({ error: { code: "CONFLICT", message: "Email already in use" } });
      }

      // Check unique username
      const [existingUsername] = await db.select().from(users).where(eq(users.username, data.username.trim()));
      if (existingUsername) {
        return reply.code(409).send({ error: { code: "CONFLICT", message: "Username already taken" } });
      }

      const passwordHash = await bcrypt.hash(data.password, 10);
      const rawUser = await createUser({
        username: data.username.trim(),
        email: normalizedEmail,
        passwordHash,
        dateOfBirth: data.dateOfBirth,
      });

      if (!rawUser) {
        throw new Error("Failed to create user record");
      }

      // Create initial progress record
      await db.insert(userProgress).values({
        userId: rawUser.id,
        level: 1,
        xp: 0,
        xpGoal: 1000,
        streak: 0,
        peakRating: 1500,
      });

      const user = toPublicUser(rawUser);
      const accessToken = app.jwt.sign({ id: rawUser.id });

      // Issue refresh token
      const rawRefreshToken = generateSecureToken();
      const hashedRefreshToken = hashSecureToken(rawRefreshToken);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      await db.insert(refreshTokens).values({
        userId: rawUser.id,
        tokenHash: hashedRefreshToken,
        expiresAt,
      });

      return reply.code(201).send({ user, accessToken, refreshToken: rawRefreshToken });
    } catch (err: any) {
      return reply.code(400).send({ error: { code: "BAD_REQUEST", message: err.message } });
    }
  });

  app.post("/login", async (request, reply) => {
    try {
      const data = loginSchema.parse(request.body);
      const normalizedEmail = data.email.trim().toLowerCase();

      const rawUser = await getUserByEmail(normalizedEmail);
      if (!rawUser) {
        return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Invalid credentials" } });
      }

      const valid = await bcrypt.compare(data.password, rawUser.passwordHash);
      if (!valid) {
        return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Invalid credentials" } });
      }

      const user = toPublicUser(rawUser);
      const accessToken = app.jwt.sign({ id: rawUser.id });

      // Issue refresh token
      const rawRefreshToken = generateSecureToken();
      const hashedRefreshToken = hashSecureToken(rawRefreshToken);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await db.insert(refreshTokens).values({
        userId: rawUser.id,
        tokenHash: hashedRefreshToken,
        expiresAt,
      });

      return reply.code(200).send({ user, accessToken, refreshToken: rawRefreshToken });
    } catch (err: any) {
      return reply.code(400).send({ error: { code: "BAD_REQUEST", message: err.message } });
    }
  });

  app.post("/refresh", async (request, reply) => {
    try {
      const { refreshToken } = request.body as { refreshToken?: string };
      if (!refreshToken) {
        return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Refresh token required" } });
      }

      const hashedToken = hashSecureToken(refreshToken);
      const [tokenRecord] = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, hashedToken));

      if (!tokenRecord || tokenRecord.revokedAt || new Date() > tokenRecord.expiresAt) {
        return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Invalid or expired refresh token" } });
      }

      // Rotate token: revoke current, issue new
      await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, tokenRecord.id));

      const accessToken = app.jwt.sign({ id: tokenRecord.userId });
      const rawRefreshToken = generateSecureToken();
      const hashedRefreshToken = hashSecureToken(rawRefreshToken);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await db.insert(refreshTokens).values({
        userId: tokenRecord.userId,
        tokenHash: hashedRefreshToken,
        expiresAt,
      });

      return reply.code(200).send({ accessToken, refreshToken: rawRefreshToken });
    } catch (err: any) {
      return reply.code(400).send({ error: { code: "BAD_REQUEST", message: err.message } });
    }
  });

  app.post("/logout", async (request, reply) => {
    try {
      const { refreshToken } = request.body as { refreshToken?: string };
      if (refreshToken) {
        const hashedToken = hashSecureToken(refreshToken);
        await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.tokenHash, hashedToken));
      }
      return reply.code(200).send({ success: true });
    } catch (err: any) {
      return reply.code(400).send({ error: { code: "BAD_REQUEST", message: err.message } });
    }
  });

  app.post("/forgot-password", async (request, reply) => {
    try {
      const { email } = request.body as { email?: string };
      if (!email) {
        return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Email required" } });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const user = await getUserByEmail(normalizedEmail);

      if (user) {
        const rawResetToken = generateSecureToken();
        const hashedResetToken = hashSecureToken(rawResetToken);
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

        await db.insert(passwordResetTokens).values({
          userId: user.id,
          tokenHash: hashedResetToken,
          expiresAt,
        });

        // Development logging guard
        console.log(`[DEVELOPMENT ONLY] Password Reset URL: http://localhost:3000/reset-password?token=${rawResetToken}`);
      }

      // ALWAYS return 202 Accepted
      return reply.code(202).send({ message: "Accepted" });
    } catch (err: any) {
      return reply.code(400).send({ error: { code: "BAD_REQUEST", message: err.message } });
    }
  });

  app.post("/reset-password", async (request, reply) => {
    try {
      const { token, password } = request.body as { token?: string; password?: string };
      if (!token || !password) {
        return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Token and password required" } });
      }

      if (password.length < 8) {
        return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Password must be at least 8 characters" } });
      }

      const hashedToken = hashSecureToken(token);
      const [tokenRecord] = await db
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.tokenHash, hashedToken));

      if (!tokenRecord || tokenRecord.usedAt || new Date() > tokenRecord.expiresAt) {
        return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Invalid or expired reset token" } });
      }

      // Mark token as used
      await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, tokenRecord.id));

      // Hash password and update user
      const passwordHash = await bcrypt.hash(password, 10);
      await db.update(users).set({ passwordHash }).where(eq(users.id, tokenRecord.userId));

      // Revoke all existing refresh tokens for this user
      await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.userId, tokenRecord.userId));

      return reply.code(200).send({ success: true });
    } catch (err: any) {
      return reply.code(400).send({ error: { code: "BAD_REQUEST", message: err.message } });
    }
  });
};
