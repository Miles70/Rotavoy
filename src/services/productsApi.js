const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

async function storeRequest(path) {
  const response = await fetch(`${apiBaseUrl}/api${path}`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Product request failed.");
  }

  return data;
}

export function getStoreProducts({ page = 1, limit = 24, search = "", category = "" } = {}) {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (search) query.set("search", search);
  if (category) query.set("category", category);

  return storeRequest(`/products?${query.toString()}`);
}

export function getStoreProduct(productKey) {
  return storeRequest(`/products/${encodeURIComponent(productKey)}`);
}
