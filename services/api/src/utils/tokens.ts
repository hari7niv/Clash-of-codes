import crypto from "crypto";

export const generateSecureToken = () => crypto.randomBytes(32).toString("hex");

export const hashSecureToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

export const refreshExpiry = () => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  return expiresAt;
};
