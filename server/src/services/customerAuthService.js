import crypto from "node:crypto";
import { verifyMessage } from "viem";

import { normalizeEvmAddress } from "../config/cryptoPayment.js";
import { Customer } from "../models/Customer.js";
import { CustomerAuthChallenge } from "../models/CustomerAuthChallenge.js";
import { CustomerSession } from "../models/CustomerSession.js";
import { verifyFirebaseIdToken } from "./firebaseTokenVerification.js";

const SESSION_DAYS = 30;
const GUEST_SESSION_DAYS = 14;
const WALLET_CHALLENGE_MINUTES = 10;

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

export function hashCustomerToken(value) {
  return crypto
    .createHash("sha256")
    .update(String(value || ""))
    .digest("hex");
}

export function serializeCustomer(customerDocument) {
  const customer = customerDocument?.toObject
    ? customerDocument.toObject()
    : customerDocument;

  if (!customer) return null;

  return {
    id: String(customer._id),
    provider: customer.provider,
    providerId: customer.providerId,
    email: customer.email || "",
    emailVerified: Boolean(customer.emailVerified),
    displayName: customer.displayName || "",
    photoUrl: customer.photoUrl || "",
    profile: {
      fullName: customer.profile?.fullName || "",
      email: customer.profile?.email || "",
      phone: customer.profile?.phone || "",
    },
    createdAt: customer.createdAt || null,
    updatedAt: customer.updatedAt || null,
  };
}

export async function createCustomerSession(customer, { guest = false } = {}) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() +
      (guest ? GUEST_SESSION_DAYS : SESSION_DAYS) * 24 * 60 * 60 * 1000,
  );

  await CustomerSession.create({
    customer: customer._id,
    provider: customer.provider,
    tokenHash: hashCustomerToken(token),
    expiresAt,
  });

  return {
    token,
    expiresAt,
    provider: customer.provider,
    providerId: customer.providerId,
    customer: serializeCustomer(customer),
  };
}

export async function createFirebaseCustomerSession(idToken) {
  const identity = await verifyFirebaseIdToken(idToken);
  const customer = await Customer.findOneAndUpdate(
    { provider: "firebase", providerId: identity.uid },
    {
      $set: {
        email: identity.email,
        emailVerified: identity.emailVerified,
        displayName: identity.name,
        photoUrl: identity.picture,
        lastLoginAt: new Date(),
      },
      $setOnInsert: {
        profile: {
          fullName: identity.name,
          email: identity.email,
          phone: "",
        },
      },
    },
    {
      upsert: true,
      returnDocument: "after",
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );

  if (!customer.profile?.fullName && identity.name) {
    customer.profile.fullName = identity.name;
  }
  if (!customer.profile?.email && identity.email) {
    customer.profile.email = identity.email;
  }
  await customer.save();

  return createCustomerSession(customer);
}

function normalizeGuestId(value) {
  const guestId = cleanText(value, 180);
  return /^[a-zA-Z0-9:_-]{16,180}$/.test(guestId)
    ? guestId
    : crypto.randomUUID();
}

export async function createGuestCustomerSession(legacyGuestId) {
  const providerId = normalizeGuestId(legacyGuestId);
  const customer = await Customer.findOneAndUpdate(
    { provider: "guest", providerId },
    {
      $set: { lastLoginAt: new Date() },
      $setOnInsert: {
        displayName: "Guest",
        profile: { fullName: "", email: "", phone: "" },
      },
    },
    {
      upsert: true,
      returnDocument: "after",
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );

  return createCustomerSession(customer, { guest: true });
}

export async function createWalletChallenge(addressValue) {
  const address = normalizeEvmAddress(addressValue);

  if (!address) {
    const error = new Error("A valid wallet address is required.");
    error.statusCode = 400;
    throw error;
  }

  const nonce = crypto.randomBytes(18).toString("base64url");
  const issuedAt = new Date();
  const expiresAt = new Date(
    issuedAt.getTime() + WALLET_CHALLENGE_MINUTES * 60 * 1000,
  );
  const appName = cleanText(
    process.env.CUSTOMER_AUTH_APP_NAME || "Masterota",
    80,
  );
  const message = [
    `${appName} wallet sign-in`,
    "",
    "Sign this message to securely access your customer account.",
    "This request does not trigger a blockchain transaction or gas fee.",
    "",
    `Wallet: ${address}`,
    `Nonce: ${nonce}`,
    `Issued at: ${issuedAt.toISOString()}`,
    `Expires at: ${expiresAt.toISOString()}`,
  ].join("\n");

  const challenge = await CustomerAuthChallenge.create({
    provider: "wallet",
    identifier: address,
    nonce,
    message,
    expiresAt,
  });

  return {
    challengeId: String(challenge._id),
    address,
    message,
    expiresAt,
  };
}

export async function createWalletCustomerSession({
  address: addressValue,
  challengeId,
  signature,
}) {
  const address = normalizeEvmAddress(addressValue);
  const normalizedSignature = cleanText(signature, 300);

  if (
    !address ||
    !challengeId ||
    !/^0x[a-fA-F0-9]{130}$/.test(normalizedSignature)
  ) {
    const error = new Error("Wallet authentication request is invalid.");
    error.statusCode = 400;
    throw error;
  }

  const challenge = await CustomerAuthChallenge.findOne({
    _id: challengeId,
    provider: "wallet",
    identifier: address,
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!challenge) {
    const error = new Error("Wallet sign-in request has expired.");
    error.statusCode = 401;
    throw error;
  }

  const valid = await verifyMessage({
    address,
    message: challenge.message,
    signature: normalizedSignature,
  });

  if (!valid) {
    const error = new Error("Wallet signature could not be verified.");
    error.statusCode = 401;
    throw error;
  }

  const consumed = await CustomerAuthChallenge.findOneAndUpdate(
    { _id: challenge._id, usedAt: null },
    { $set: { usedAt: new Date() } },
    { returnDocument: "after" },
  );

  if (!consumed) {
    const error = new Error("Wallet sign-in request was already used.");
    error.statusCode = 409;
    throw error;
  }

  const customer = await Customer.findOneAndUpdate(
    { provider: "wallet", providerId: address },
    {
      $set: {
        displayName: `${address.slice(0, 6)}...${address.slice(-4)}`,
        lastLoginAt: new Date(),
      },
      $setOnInsert: {
        profile: { fullName: "", email: "", phone: "" },
      },
    },
    {
      upsert: true,
      returnDocument: "after",
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );

  return createCustomerSession(customer);
}
