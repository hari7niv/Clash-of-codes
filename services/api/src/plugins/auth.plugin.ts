import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AppError } from "../utils/errors.js";

const errorHandlerPlugin: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((err, _request, reply: FastifyReply) => {
    if (err instanceof ZodError) {
      const fields: Record<string, string> = {};
      for (const issue of err.issues) {
        const key = issue.path.join(".") || "_";
        fields[key] = issue.message;
      }
      return reply.code(400).send({
        error: { code: "VALIDATION_ERROR", message: "Invalid request", fields },
      });
    }

    if (err instanceof AppError) {
      return reply.code(err.statusCode).send({
        error: { code: err.code, message: err.message, fields: err.fields },
      });
    }

    app.log.error(err);
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return reply.code(status).send({
      error: {
        code: status === 429 ? "RATE_LIMITED" : "INTERNAL_ERROR",
        message: status >= 500 ? "Internal server error" : err.message,
      },
    });
  });
};

export const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  }
};

const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorate("authenticate", authenticate);
};

export default fp(async (app) => {
  await app.register(fp(errorHandlerPlugin, { name: "error-handler" }));
  await app.register(fp(authPlugin, { name: "auth" }));
}, { name: "core-plugins" });
