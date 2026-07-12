const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function normalizeProduct(product) {
  if (!product) return product;

  return {
    ...product,
    imageUrl: product.imageUrl || product.images?.[0] || "",
  };
}

async function storeRequest(path) {
  const response = await fetch(`${apiBaseUrl}/api${path}`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Product request failed.");
  }

  return data;
}

export async function getStoreProducts({ page = 1, limit = 24, search = "", category = "" } = {}) {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (search) query.set("search", search);
  if (category) query.set("category", category);

  const data = await storeRequest(`/products?${query.toString()}`);

  return {
    ...data,
    products: (data.products || []).map(normalizeProduct),
  };
}

export async function getStoreProduct(productKey) {
  const data = await storeRequest(`/products/${encodeURIComponent(productKey)}`);

  return {
    ...data,
    product: normalizeProduct(data.product),
  };
}
