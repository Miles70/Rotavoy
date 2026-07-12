const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const tokenStorageKey = "kemalreis_admin_token";

export function getStoredAdminToken() {
  return sessionStorage.getItem(tokenStorageKey) || "";
}

export function storeAdminToken(token) {
  sessionStorage.setItem(tokenStorageKey, token);
}

export function clearAdminToken() {
  sessionStorage.removeItem(tokenStorageKey);
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
  return adminRequest("/analytics", { token });
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

export async function getAdminProducts(token) {
  return adminRequest("/products", { token });
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
