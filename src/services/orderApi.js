import { getCustomerAccessToken } from "./customerApi";

const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "The server could not process your request.");
  }

  return data;
}

function getHeaders() {
  const token = getCustomerAccessToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function getShippingQuote(payload) {
  const response = await fetch(`${apiBaseUrl}/api/orders/shipping-quote`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await parseResponse(response);
  return data.quote;
}

export async function createOrder(payload) {
  const response = await fetch(`${apiBaseUrl}/api/orders`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await parseResponse(response);
  return data.order;
}

export async function verifyOrderPayment(orderNumber, payload) {
  const response = await fetch(
    `${apiBaseUrl}/api/orders/${encodeURIComponent(orderNumber)}/verify-payment`,
    {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    },
  );

  const data = await parseResponse(response);
  return data.order;
}
