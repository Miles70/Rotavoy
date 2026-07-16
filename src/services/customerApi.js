const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const CUSTOMER_SESSION_STORAGE_KEY = "rotavoy_customer_session";

function safeParse(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

async function parseResponse(response) {
  if (response.status === 204) return null;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "The server could not process your request.");
    error.status = response.status;
    throw error;
  }
  return data;
}

export function getStoredCustomerSession() {
  const session = safeParse(localStorage.getItem(CUSTOMER_SESSION_STORAGE_KEY));

  if (!session?.token || !session?.provider || !session?.providerId) {
    return null;
  }

  if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
    localStorage.removeItem(CUSTOMER_SESSION_STORAGE_KEY);
    return null;
  }

  return session;
}

export function storeCustomerSession(session) {
  if (!session?.token) return null;
  localStorage.setItem(CUSTOMER_SESSION_STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function clearStoredCustomerSession() {
  localStorage.removeItem(CUSTOMER_SESSION_STORAGE_KEY);
}

export function getCustomerAccessToken() {
  return getStoredCustomerSession()?.token || "";
}

function authenticatedHeaders(headers = {}) {
  const token = getCustomerAccessToken();
  return {
    ...headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(path, options = {}, { authenticated = false } = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: authenticated
      ? authenticatedHeaders(options.headers)
      : options.headers,
  });
  return parseResponse(response);
}

export async function createFirebaseCustomerSession(idToken) {
  const data = await request("/api/customer-auth/firebase", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  return storeCustomerSession(data.session);
}

export async function createGuestCustomerSession(guestId) {
  const data = await request("/api/customer-auth/guest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guestId }),
  });
  return storeCustomerSession(data.session);
}

export async function createWalletChallenge(address) {
  const data = await request("/api/customer-auth/wallet/challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });
  return data.challenge;
}

export async function createWalletCustomerSession(payload) {
  const data = await request("/api/customer-auth/wallet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return storeCustomerSession(data.session);
}

export async function validateCustomerSession() {
  const storedSession = getStoredCustomerSession();
  if (!storedSession) return null;

  const data = await request(
    "/api/customer-auth/session",
    { method: "GET" },
    { authenticated: true },
  );

  return storeCustomerSession({
    ...storedSession,
    ...data.session,
    token: storedSession.token,
  });
}

export async function logoutCustomerSession() {
  const storedSession = getStoredCustomerSession();
  if (!storedSession) return;

  try {
    await request(
      "/api/customer-auth/logout",
      { method: "POST" },
      { authenticated: true },
    );
  } finally {
    clearStoredCustomerSession();
  }
}

export async function fetchCustomerAccount() {
  return request(
    "/api/customer",
    { method: "GET" },
    { authenticated: true },
  );
}

export async function saveCustomerAccount(account) {
  return request(
    "/api/customer",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(account),
    },
    { authenticated: true },
  );
}

export async function claimCustomerOrders(orders) {
  return request(
    "/api/customer/claim-orders",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orders }),
    },
    { authenticated: true },
  );
}
