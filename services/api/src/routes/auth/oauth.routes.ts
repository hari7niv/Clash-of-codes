import { FastifyPluginAsync } from "fastify";
import oauth2 from "@fastify/oauth2";
import crypto from "crypto";
import { db } from "../../db/client.js";
import { users, refreshTokens } from "../../db/schema/users.js";
import { eq } from "drizzle-orm";

const generateSecureToken = () => crypto.randomBytes(32).toString("hex");
const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

/** Issue a session for an OAuth user — upserts the user and returns JWT + refresh token */
async function issueOAuthSession(app: any, providerUserId: string, email: string, username: string) {
  const normalizedEmail = email.trim().toLowerCase();

  let [user] = await db.select().from(users).where(eq(users.email, normalizedEmail));

  if (!user) {
    // Auto-register: pick a unique username
    let candidateUsername = username.replace(/[^a-zA-Z0-9_]/g, "").substring(0, 20) || "player";
    const [existing] = await db.select().from(users).where(eq(users.username, candidateUsername));
    if (existing) {
      candidateUsername = `${candidateUsername}${Math.floor(Math.random() * 9999)}`;
    }
    [user] = await db
      .insert(users)
      .values({
        username: candidateUsername,
        email: normalizedEmail,
        passwordHash: `oauth:${providerUserId}`, // sentinel — not a real hash
      })
      .returning();
  }

  const accessToken = app.jwt.sign({ id: user.id });
  const rawRefreshToken = generateSecureToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashToken(rawRefreshToken),
    expiresAt,
  });

  return { user, accessToken, refreshToken: rawRefreshToken };
}

export const oauthRoutes: FastifyPluginAsync = async (app) => {
  const callbackBase = process.env.OAUTH_CALLBACK_BASE || "http://localhost:4000";
  const githubEnabled = !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
  const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  // ── GitHub OAuth ─────────────────────────────────────────────────────────
  if (githubEnabled) {
    await app.register(oauth2, {
      name: "githubOAuth2",
      scope: ["user:email"],
      credentials: {
        client: {
          id: process.env.GITHUB_CLIENT_ID!,
          secret: process.env.GITHUB_CLIENT_SECRET!,
        },
        auth: (oauth2 as any).GITHUB_CONFIGURATION,
      },
      startRedirectPath: "/api/auth/oauth/github",
      callbackUri: `${callbackBase}/api/auth/oauth/github/callback`,
    });

    app.get("/oauth/github/callback", async (request, reply) => {
      try {
        const token = await (app as any).githubOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);
        
        // Fetch GitHub user info
        const userRes = await fetch("https://api.github.com/user", {
          headers: { Authorization: `Bearer ${token.token.access_token}` },
        });
        const ghUser: any = await userRes.json();

        // Fetch email if not public
        let email = ghUser.email;
        if (!email) {
          const emailRes = await fetch("https://api.github.com/user/emails", {
            headers: { Authorization: `Bearer ${token.token.access_token}` },
          });
          const emails = (await emailRes.json()) as any[];
          email = emails.find((e: any) => e.primary && e.verified)?.email || emails[0]?.email;
        }

        if (!email) {
          return reply.code(400).send({ error: { code: "OAUTH_ERROR", message: "GitHub account has no verified email" } });
        }

        const session = await issueOAuthSession(app, String(ghUser.id), email, ghUser.login || ghUser.name || "GHUser");
        
        // Redirect to frontend with tokens in query (frontend stores them)
        const frontendUrl = process.env.CORS_ORIGIN || "http://localhost:3000";
        return reply.redirect(
          `${frontendUrl}/oauth/callback?token=${session.accessToken}&refreshToken=${session.refreshToken}`
        );
      } catch (err: any) {
        return reply.code(400).send({ error: { code: "OAUTH_ERROR", message: err.message } });
      }
    });
  }

  // ── Google OAuth ─────────────────────────────────────────────────────────
  if (googleEnabled) {
    await app.register(oauth2, {
      name: "googleOAuth2",
      scope: ["openid", "email", "profile"],
      credentials: {
        client: {
          id: process.env.GOOGLE_CLIENT_ID!,
          secret: process.env.GOOGLE_CLIENT_SECRET!,
        },
        auth: (oauth2 as any).GOOGLE_CONFIGURATION,
      },
      startRedirectPath: "/api/auth/oauth/google",
      callbackUri: `${callbackBase}/api/auth/oauth/google/callback`,
    });

    app.get("/oauth/google/callback", async (request, reply) => {
      try {
        const token = await (app as any).googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);

        const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${token.token.access_token}` },
        });
        const googleUser: any = await userInfoRes.json();

        if (!googleUser.email) {
          return reply.code(400).send({ error: { code: "OAUTH_ERROR", message: "Google account has no email" } });
        }

        const session = await issueOAuthSession(app, googleUser.id, googleUser.email, googleUser.name || googleUser.given_name || "GoogleUser");

        const frontendUrl = process.env.CORS_ORIGIN || "http://localhost:3000";
        return reply.redirect(
          `${frontendUrl}/oauth/callback?token=${session.accessToken}&refreshToken=${session.refreshToken}`
        );
      } catch (err: any) {
        return reply.code(400).send({ error: { code: "OAUTH_ERROR", message: err.message } });
      }
    });
  }

  // ── Status endpoint: tells frontend which providers are enabled ───────────
  app.get("/oauth/providers", async (_request, reply) => {
    return {
      github: githubEnabled,
      google: googleEnabled,
    };
  });
};
