import crypto from "node:crypto";
import { getPublicCryptoPaymentConfig } from "../config/cryptoPayment.js";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";

const MAX_ORDER_ITEMS = 50;
const MAX_ITEM_QUANTITY = 10;
const PAYMENT_METHODS = new Set(["not_selected", "card", "crypto"]);

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeCustomer(customer = {}) {
  const normalized = {
    fullName: cleanText(customer.fullName, 120),
    email: cleanText(customer.email, 180).toLowerCase(),
    phone: cleanText(customer.phone, 40),
    city: cleanText(customer.city, 100),
    address: cleanText(customer.address, 500),
    note: cleanText(customer.note, 1000),
  };

  const requiredFields = ["fullName", "email", "phone", "city", "address"];
  const missingField = requiredFields.find((field) => !normalized[field]);

  if (missingField) {
    const error = new Error(`Missing required customer field: ${missingField}`);
    error.statusCode = 400;
    throw error;
  }

  if (!/^\S+@\S+\.\S+$/.test(normalized.email)) {
    const error = new Error("Please provide a valid email address.");
    error.statusCode = 400;
    throw error;
  }

  return normalized;
}

function normalizePaymentMethod(value) {
  const paymentMethod = cleanText(value || "not_selected", 30).toLowerCase();

  if (!PAYMENT_METHODS.has(paymentMethod)) {
    const error = new Error("Unsupported payment method.");
    error.statusCode = 400;
    throw error;
  }

  return paymentMethod;
}

function normalizeRequestedItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error("Your cart is empty.");
    error.statusCode = 400;
    throw error;
  }

  if (items.length > MAX_ORDER_ITEMS) {
    const error = new Error("Too many different products in one order.");
    error.statusCode = 400;
    throw error;
  }

  const quantitiesByKey = new Map();

  for (const item of items) {
    const productKey = cleanText(item.productKey || item.key, 100);
    const quantity = Number.parseInt(item.quantity, 10);

    if (!productKey || !Number.isInteger(quantity) || quantity < 1) {
      const error = new Error("Invalid product or quantity.");
      error.statusCode = 400;
      throw error;
    }

    const nextQuantity = (quantitiesByKey.get(productKey) || 0) + quantity;

    if (nextQuantity > MAX_ITEM_QUANTITY) {
      const error = new Error(`Maximum quantity is ${MAX_ITEM_QUANTITY} per product.`);
      error.statusCode = 400;
      throw error;
    }

    quantitiesByKey.set(productKey, nextQuantity);
  }

  return [...quantitiesByKey.entries()].map(([productKey, quantity]) => ({
    productKey,
    quantity,
  }));
}

function createOrderNumber() {
  const date = new Date();
  const datePart = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("");
  const randomPart = crypto.randomBytes(4).toString("hex").toUpperCase();

  return `MTR-${datePart}-${randomPart}`;
}

function getPaymentData(paymentMethod, total) {
  if (paymentMethod === "crypto") {
    const config = getPublicCryptoPaymentConfig();

    return {
      ...config,
      expectedAmount: Number(total).toFixed(2),
      currency: config.token,
    };
  }

  if (paymentMethod === "card") {
    return {
      configured: false,
      provider: "stripe",
      expectedAmount: Number(total).toFixed(2),
      currency: "USD",
    };
  }

  return {
    configured: false,
    provider: "none",
  };
}

export function serializeOrder(orderDocument) {
  const order = orderDocument.toObject ? orderDocument.toObject() : orderDocument;
  const payment = order.payment || {};

  return {
    id: order.orderNumber,
    databaseId: String(order._id),
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    payment: {
      configured: Boolean(payment.configured),
      provider: payment.provider || "none",
      network: payment.network || "",
      chainId: payment.chainId || null,
      token: payment.token || "",
      tokenAddress: payment.tokenAddress || "",
      tokenDecimals:
        Number.isInteger(payment.tokenDecimals) ? payment.tokenDecimals : null,
      payerAddress: payment.payerAddress || "",
      recipientAddress: payment.recipientAddress || "",
      transactionHash: payment.transactionHash || "",
      expectedAmount: payment.expectedAmount || "",
      amount: payment.amount || "",
      currency: payment.currency || "",
      blockNumber: payment.blockNumber || null,
      confirmations: Number(payment.confirmations || 0),
      confirmedAt: payment.confirmedAt || null,
      failedAt: payment.failedAt || null,
      failureReason: payment.failureReason || "",
    },
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    customer: order.customer,
    items: order.items.map((item) => ({
      key: item.productKey,
      title: item.title,
      categoryKey: item.categoryKey,
      image: item.image,
      imageUrl: item.imageUrl,
      price: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    subtotal: order.subtotal,
    shipping: order.shipping,
    total: order.total,
    currency: order.currency,
  };
}

export async function createOrder(payload = {}) {
  const customer = normalizeCustomer(payload.customer);
  const paymentMethod = normalizePaymentMethod(payload.paymentMethod);
  const requestedItems = normalizeRequestedItems(payload.items);
  const productKeys = requestedItems.map((item) => item.productKey);

  const products = await Product.find({
    key: { $in: productKeys },
    isActive: true,
  }).lean();

  const productsByKey = new Map(products.map((product) => [product.key, product]));

  const orderItems = requestedItems.map(({ productKey, quantity }) => {
    const product = productsByKey.get(productKey);

    if (!product) {
      const error = new Error(`Product is unavailable: ${productKey}`);
      error.statusCode = 409;
      throw error;
    }

    if (product.stock < quantity) {
      const error = new Error(`Not enough stock for ${product.title}.`);
      error.statusCode = 409;
      throw error;
    }

    const unitPrice = Number(product.price);
    const lineTotal = Number((unitPrice * quantity).toFixed(2));

    return {
      productKey: product.key,
      title: product.title,
      categoryKey: product.categoryKey,
      image: product.image,
      imageUrl: product.imageUrl,
      unitPrice,
      quantity,
      lineTotal,
    };
  });

  const subtotal = Number(
    orderItems.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2)
  );
  const shipping = 0;
  const total = Number((subtotal + shipping).toFixed(2));

  const order = await Order.create({
    orderNumber: createOrderNumber(),
    status: paymentMethod === "not_selected" ? "pending" : "awaiting_payment",
    paymentStatus: "unpaid",
    paymentMethod,
    payment: getPaymentData(paymentMethod, total),
    customer,
    items: orderItems,
    subtotal,
    shipping,
    total,
    currency: "USD",
  });

  return serializeOrder(order);
}
