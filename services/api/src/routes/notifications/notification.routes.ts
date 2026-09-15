import { FastifyPluginAsync } from "fastify";
import { db } from "../../db/client.js";
import { notifications } from "../../db/schema/events.js";
import { eq, and, desc } from "drizzle-orm";

export const notificationRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
    }
  });

  // FR-13.1: Get all notifications for the current user
  app.get("/", async (request, reply) => {
    const { id: userId } = request.user as { id: string };
    const query = request.query as { unreadOnly?: string; limit?: string };
    const limit = parseInt(query.limit || "20", 10);
    const unreadOnly = query.unreadOnly === "true";

    let q = db.select().from(notifications).where(
      unreadOnly
        ? and(eq(notifications.userId, userId), eq(notifications.read, false))
        : eq(notifications.userId, userId)
    );

    const items = await (q as any).orderBy(desc(notifications.createdAt)).limit(limit);

    const unreadCount = await db
      .select({ count: db.$count(notifications) })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));

    return {
      items,
      unreadCount: unreadCount[0]?.count ?? 0,
    };
  });

  // FR-13.1: Mark a notification as read
  app.patch("/:notificationId/read", async (request, reply) => {
    const { id: userId } = request.user as { id: string };
    const { notificationId } = request.params as { notificationId: string };

    const [existing] = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));

    if (!existing) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Notification not found" } });
    }

    await db.update(notifications).set({ read: true }).where(eq(notifications.id, notificationId));
    return { success: true };
  });

  // FR-13.1: Mark all notifications as read
  app.patch("/read-all", async (request, reply) => {
    const { id: userId } = request.user as { id: string };
    await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId));
    return { success: true };
  });

  // FR-13.1: Delete a notification
  app.delete("/:notificationId", async (request, reply) => {
    const { id: userId } = request.user as { id: string };
    const { notificationId } = request.params as { notificationId: string };

    await db
      .delete(notifications)
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));

    return { success: true };
  });
};
