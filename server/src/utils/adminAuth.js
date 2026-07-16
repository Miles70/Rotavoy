import { randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const activeSessions = new Map();

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getAdminConfig() {
  const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || "");

  if (!email || !password) {
    throw createHttpError(
      "Admin authentication is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD.",
      503
    );
  }

  return { email, password };
}

function safeEqual(leftValue, rightValue) {
  const left = Buffer.from(String(leftValue));
  const right = Buffer.from(String(rightValue));

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

function clearExpiredSessions() {
  const now = Date.now();

  for (const [token, session] of activeSessions.entries()) {
    if (session.expiresAt <= now) {
      activeSessions.delete(token);
    }
  }
}

export function verifyAdminCredentials(email, password) {
  const config = getAdminConfig();
  const normalizedEmail = String(email || "").trim().toLowerCase();

  return safeEqual(normalizedEmail, config.email) && safeEqual(password, config.password);
}

export function createAdminToken() {
  const config = getAdminConfig();
  const issuedAt = Date.now();
  const token = randomBytes(48).toString("base64url");

  clearExpiredSessions();
  activeSessions.set(token, {
    email: config.email,
    issuedAt,
    expiresAt: issuedAt + TOKEN_TTL_MS,
  });

  return token;
}

export function verifyAdminToken(token) {
  getAdminConfig();
  clearExpiredSessions();

  const normalizedToken = String(token || "");
  const session = activeSessions.get(normalizedToken);

  if (!session) {
    throw createHttpError("Invalid or expired admin session.", 401);
  }

  return {
    sub: "rotavoy-admin",
    email: session.email,
    iat: Math.floor(session.issuedAt / 1000),
    exp: Math.floor(session.expiresAt / 1000),
  };
}
