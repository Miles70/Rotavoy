// Sandbox remains available in development/staging, never on production.
export function getBookingAvailability(env = process.env) {
  const key = String(env.NUITEE_API_KEY || "").trim();
  const environment = key.startsWith("sand_") ? "sandbox" : key ? "production" : "unconfigured";
  const deployment = env.ROTAVOY_ENV || (env.NODE_ENV === "production" ? "production" : "development");
  const providerAllowed = environment !== "unconfigured" &&
    !(deployment === "production" && environment !== "production") &&
    !(deployment === "staging" && environment !== "sandbox");
  const enabled = (name) => String(env[name] || "").toLowerCase() === "true";
  return {
    configured: Boolean(key),
    environment,
    providerAllowed,
    cardBookingEnabled: providerAllowed && (environment === "sandbox"
      ? true
      : enabled("NUITEE_ENABLE_LIVE_BOOKING")),
    // Preserve the existing explicitly enabled sandbox workflow. The configured
    // BSC/Ethereum networks use real funds even when the hotel provider is sandbox.
    // Live crypto stays closed until settlement/ownership/reconciliation are ready.
    cryptoBookingEnabled: providerAllowed && environment === "sandbox" && enabled("NUITEE_ENABLE_SANDBOX_BOOKING"),
  };
}

export function assertProviderAvailable() {
  if (!getBookingAvailability().providerAllowed) {
    const error = new Error("Hotel service is temporarily unavailable.");
    error.statusCode = 503;
    throw error;
  }
}

export function assertBookingAvailable(method) {
  const availability = getBookingAvailability();
  if (!availability[method === "card" ? "cardBookingEnabled" : "cryptoBookingEnabled"]) {
    const error = new Error("This payment method is temporarily unavailable.");
    error.statusCode = 503;
    throw error;
  }
}
