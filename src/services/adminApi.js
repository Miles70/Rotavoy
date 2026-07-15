const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const tokenStorageKey = "masterota_admin_token";
const legacyTokenStorageKey = "kemalreis_admin_token";

export function getStoredAdminToken() {
  const storedToken = sessionStorage.getItem(tokenStorageKey);

  if (storedToken) {
    return storedToken;
  }

  const legacyToken = sessionStorage.getItem(legacyTokenStorageKey) || "";

  if (legacyToken) {
    sessionStorage.setItem(tokenStorageKey, legacyToken);
    sessionStorage.removeItem(legacyTokenStorageKey);
  }

  return legacyToken;
}

export function storeAdminToken(token) {
  sessionStorage.setItem(tokenStorageKey, token);
  sessionStorage.removeItem(legacyTokenStorageKey);
}

export function clearAdminToken() {
  sessionStorage.removeItem(tokenStorageKey);
  sessionStorage.removeItem(legacyTokenStorageKey);
}

async function adminRequest(path, { token, method = "GET", body } = {}) {
  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${apiBaseUrl}/api/admin${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      clearAdminToken();
    }

    const error = new Error(data.message || "Admin request failed.");
    error.status = response.status;
    throw error;
  }

  return data;
}

export async function loginAdmin(email, password) {
  return adminRequest("/login", {
    method: "POST",
    body: { email, password },
  });
}

export async function getAdminSession(token) {
  return adminRequest("/session", { token });
}

export async function getAdminDashboard(token) {
  return adminRequest("/dashboard", { token });
}

export async function getAdminAnalytics(token) {
  try {
    return await adminRequest("/analytics", { token });
  } catch (error) {
    if (error.status === 401) {
      throw error;
    }

    console.warn("Admin analytics could not be loaded:", error.message);
    return {
      orderTrend: [],
      statusBreakdown: [],
    };
  }
}

export async function getAdminOrders(token, status = "") {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return adminRequest(`/orders${query}`, { token });
}

export async function updateAdminOrder(token, orderNumber, updates) {
  return adminRequest(`/orders/${encodeURIComponent(orderNumber)}`, {
    token,
    method: "PATCH",
    body: updates,
  });
}

export async function deleteAdminOrder(token, orderNumber) {
  return adminRequest(`/orders/${encodeURIComponent(orderNumber)}`, {
    token,
    method: "DELETE",
  });
}

export async function deleteAdminOrders(token, orderNumbers) {
  return adminRequest("/orders", {
    token,
    method: "DELETE",
    body: { orderNumbers },
  });
}

export async function getAdminProducts(token, { page = 1, limit = 20, search = "" } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (search) {
    params.set("search", search);
  }

  return adminRequest(`/products?${params.toString()}`, { token });
}

export async function createAdminProduct(token, product) {
  return adminRequest("/products", {
    token,
    method: "POST",
    body: product,
  });
}

export async function updateAdminProduct(token, productKey, updates) {
  return adminRequest(`/products/${encodeURIComponent(productKey)}`, {
    token,
    method: "PATCH",
    body: updates,
  });
}

export async function getAdminCampaign(token) {
  return adminRequest("/campaign", { token });
}

export async function updateAdminCampaign(token, campaign) {
  return adminRequest("/campaign", {
    token,
    method: "PATCH",
    body: campaign,
  });
}
