import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { createUser, getUserByEmail, toPublicUser } from "../../repositories/user.repo.js";

const signupSchema = z.object({
  username: z.string(),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/signup", async (request, reply) => {
    try {
      const data = signupSchema.parse(request.body);
      
      const existingUser = await getUserByEmail(data.email);
      if (existingUser) {
        return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Email already in use" } });
      }

      const passwordHash = await bcrypt.hash(data.password, 10);
      const rawUser = await createUser({
        username: data.username,
        email: data.email,
        passwordHash,
      });

      const user = toPublicUser(rawUser);
      const accessToken = app.jwt.sign({ id: user.id });
      const refreshToken = "mock-refresh-token"; // TODO: Implement refresh token DB logic

      return reply.code(201).send({ user, accessToken, refreshToken });
    } catch (err: any) {
      return reply.code(400).send({ error: { code: "BAD_REQUEST", message: err.message } });
    }
  });

  app.post("/login", async (request, reply) => {
    try {
      const data = loginSchema.parse(request.body);
      
      const rawUser = await getUserByEmail(data.email);
      if (!rawUser) {
        return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Invalid credentials" } });
      }

      const valid = await bcrypt.compare(data.password, rawUser.passwordHash);
      if (!valid) {
        return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Invalid credentials" } });
      }

      const user = toPublicUser(rawUser);
      const accessToken = app.jwt.sign({ id: user.id });
      const refreshToken = "mock-refresh-token"; // TODO: Implement refresh token DB logic

      return reply.code(200).send({ user, accessToken, refreshToken });
    } catch (err: any) {
      return reply.code(400).send({ error: { code: "BAD_REQUEST", message: err.message } });
    }
  });

  app.post("/refresh", async (request, reply) => {
    // mock refresh
    return reply.code(200).send({ accessToken: "new-mock-access-token" });
  });

  app.post("/logout", async (request, reply) => {
    return reply.code(200).send({ success: true });
  });

  app.post("/forgot-password", async (request, reply) => {
    return reply.code(202).send({ message: "Accepted" });
  });

  app.post("/reset-password", async (request, reply) => {
    return reply.code(200).send({ success: true });
  });
};
