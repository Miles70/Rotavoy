import crypto from "node:crypto";

const FIREBASE_CERT_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const DEFAULT_FIREBASE_PROJECT_ID = "gabaloo-219b1";

let cachedCertificates = null;
let certificateExpiresAt = 0;

function decodeBase64Url(value) {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padding = normalized.length % 4;
  const padded = padding
    ? normalized.padEnd(normalized.length + (4 - padding), "=")
    : normalized;
  return Buffer.from(padded, "base64");
}

function parseJsonPart(value, label) {
  try {
    return JSON.parse(decodeBase64Url(value).toString("utf8"));
  } catch {
    const error = new Error(`Invalid Firebase token ${label}.`);
    error.statusCode = 401;
    throw error;
  }
}

function getProjectId() {
  return String(
    process.env.FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_PROJECT_ID,
  ).trim();
}

function getCacheDurationMs(cacheControl) {
  const match = String(cacheControl || "").match(/max-age=(\d+)/i);
  const seconds = Number.parseInt(match?.[1], 10);
  return Number.isInteger(seconds) && seconds > 0
    ? seconds * 1000
    : 60 * 60 * 1000;
}

async function getCertificates() {
  if (cachedCertificates && Date.now() < certificateExpiresAt) {
    return cachedCertificates;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(FIREBASE_CERT_URL, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });

    if (!response.ok) {
      const error = new Error("Firebase public keys could not be loaded.");
      error.statusCode = 503;
      throw error;
    }

    cachedCertificates = await response.json();
    certificateExpiresAt =
      Date.now() + getCacheDurationMs(response.headers.get("cache-control"));
    return cachedCertificates;
  } catch (error) {
    if (error.statusCode) throw error;
    const serviceError = new Error(
      "Firebase authentication is temporarily unavailable.",
    );
    serviceError.statusCode = 503;
    throw serviceError;
  } finally {
    clearTimeout(timeout);
  }
}

function validateClaims(payload, projectId) {
  const now = Math.floor(Date.now() / 1000);
  const issuer = `https://securetoken.google.com/${projectId}`;

  if (payload.aud !== projectId || payload.iss !== issuer) {
    const error = new Error("Firebase token belongs to a different project.");
    error.statusCode = 401;
    throw error;
  }

  if (!payload.sub || typeof payload.sub !== "string" || payload.sub.length > 128) {
    const error = new Error("Firebase token does not contain a valid user id.");
    error.statusCode = 401;
    throw error;
  }

  if (!Number.isFinite(payload.exp) || payload.exp <= now) {
    const error = new Error("Firebase session has expired.");
    error.statusCode = 401;
    throw error;
  }

  if (!Number.isFinite(payload.iat) || payload.iat > now + 60) {
    const error = new Error("Firebase token issue time is invalid.");
    error.statusCode = 401;
    throw error;
  }

  if (Number.isFinite(payload.auth_time) && payload.auth_time > now + 60) {
    const error = new Error("Firebase authentication time is invalid.");
    error.statusCode = 401;
    throw error;
  }
}

export async function verifyFirebaseIdToken(idToken) {
  const parts = String(idToken || "").trim().split(".");

  if (parts.length !== 3) {
    const error = new Error("Firebase ID token is missing or invalid.");
    error.statusCode = 401;
    throw error;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseJsonPart(encodedHeader, "header");
  const payload = parseJsonPart(encodedPayload, "payload");

  if (header.alg !== "RS256" || !header.kid) {
    const error = new Error("Firebase token signature type is invalid.");
    error.statusCode = 401;
    throw error;
  }

  const certificates = await getCertificates();
  const certificate = certificates?.[header.kid];

  if (!certificate) {
    cachedCertificates = null;
    certificateExpiresAt = 0;
    const refreshedCertificates = await getCertificates();

    if (!refreshedCertificates?.[header.kid]) {
      const error = new Error("Firebase token signing key is unknown.");
      error.statusCode = 401;
      throw error;
    }
  }

  const signingCertificate = (cachedCertificates || certificates)[header.kid];
  const signedContent = Buffer.from(`${encodedHeader}.${encodedPayload}`);
  const signature = decodeBase64Url(encodedSignature);
  const verified = crypto.verify(
    "RSA-SHA256",
    signedContent,
    crypto.createPublicKey(signingCertificate),
    signature,
  );

  if (!verified) {
    const error = new Error("Firebase token signature is invalid.");
    error.statusCode = 401;
    throw error;
  }

  validateClaims(payload, getProjectId());

  return {
    uid: payload.sub,
    email: String(payload.email || "").trim().toLowerCase(),
    emailVerified: Boolean(payload.email_verified),
    name: String(payload.name || "").trim(),
    picture: String(payload.picture || "").trim(),
    provider: String(payload.firebase?.sign_in_provider || "firebase"),
  };
}
