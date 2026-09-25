import crypto from "node:crypto";
import { getPublicCryptoPaymentConfig } from "../config/cryptoPayment.js";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import {
  calculateCjFreight,
  getCjProductDetail,
  getCjVariantStock,
} from "./cjApi.js";
import { runWithOptionalMongoTransaction } from "./mongoTransactions.js";

const MAX_ORDER_ITEMS = 50;
const MAX_ITEM_QUANTITY = 10;
const PAYMENT_METHODS = new Set(["not_selected", "card", "crypto"]);
const DEFAULT_PAYMENT_TTL_MINUTES = 30;

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getMarkupMultiplier() {
  const parsed = Number(process.env.CJ_PRICE_MARKUP || 1.65);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1.65;
}

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

export function calculateCjRetailPrice(costPrice, markupMultiplier = getMarkupMultiplier()) {
  const cost = Number(costPrice);
  const markup = Number(markupMultiplier);
  if (!(cost > 0) || !(markup >= 1)) return null;
  return roundMoney(cost * markup);
}

export function extractCjVariantCost(detail, variantId) {
  const requestedVariantId = String(variantId || "").trim();
  if (!requestedVariantId) return null;

  const variants = Array.isArray(detail?.variants) ? detail.variants : [];
  const variant = variants.find(
    (candidate) => String(candidate?.vid || "").trim() === requestedVariantId,
  );
  const cost = roundMoney(variant?.variantSellPrice);
  return cost > 0 ? cost : null;
}

function getOriginCountryCode() {
  return String(process.env.CJ_FROM_COUNTRY_CODE || "CN").toUpperCase();
}

function getReservationExpiresAt() {
  const ttlMinutes = parsePositiveInteger(
    process.env.ORDER_PAYMENT_TTL_MINUTES,
    DEFAULT_PAYMENT_TTL_MINUTES,
  );
  return new Date(Date.now() + ttlMinutes * 60 * 1000);
}

function normalizeCustomer(customer = {}) {
  const normalized = {
    fullName: cleanText(customer.fullName, 120),
    email: cleanText(customer.email, 180).toLowerCase(),
    phone: cleanText(customer.phone, 40),
    country: cleanText(customer.country, 100),
    countryCode: cleanText(customer.countryCode, 2).toUpperCase(),
    province: cleanText(customer.province, 100),
    city: cleanText(customer.city, 100),
    postalCode: cleanText(customer.postalCode, 20),
    address: cleanText(customer.address, 500),
    note: cleanText(customer.note, 1000),
  };

  const requiredFields = [
    "fullName",
    "email",
    "phone",
    "country",
    "countryCode",
    "province",
    "city",
    "address",
  ];
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

  if (!/^[A-Z]{2}$/.test(normalized.countryCode)) {
    const error = new Error("Country code must be a two-letter ISO code.");
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
  return `RTV-${datePart}-${randomPart}`;
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

  return { configured: false, provider: "none" };
}

function createAvailabilityError(productKey, product) {
  const error = new Error(
    product
      ? `Not enough stock for ${product.title}.`
      : `Product is unavailable: ${productKey}`,
  );
  error.statusCode = 409;
  return error;
}

function createPricingError(product) {
  const error = new Error(
    `Live supplier pricing is unavailable for ${product?.title || "this product"}. Please refresh checkout.`,
  );
  error.statusCode = 409;
  return error;
}

async function loadRequestedProducts(requestedItems) {
  const keys = requestedItems.map((item) => item.productKey);
  const products = await Product.find({
    key: { $in: keys },
    isActive: true,
  }).lean();
  const byKey = new Map(products.map((product) => [product.key, product]));

  return requestedItems.map((item) => {
    const product = byKey.get(item.productKey);
    if (!product) throw createAvailabilityError(item.productKey, null);
    return { ...item, product };
  });
}

async function refreshSupplierPricing(lines) {
  const detailsByProductId = new Map();

  for (const line of lines) {
    const product = line.product;
    if (product.supplier !== "cj") continue;

    const pid = String(product.supplierProductId || "").trim();
    const vid = String(product.supplierVariantId || "").trim();
    if (!pid || !vid) throw createPricingError(product);

    let detail = detailsByProductId.get(pid);
    if (!detail) {
      detail = await getCjProductDetail(pid);
      detailsByProductId.set(pid, detail);
    }

    const liveCostPrice = extractCjVariantCost(detail, vid);
    const liveRetailPrice = calculateCjRetailPrice(liveCostPrice);
    if (!(liveCostPrice > 0) || !(liveRetailPrice > 0)) {
      throw createPricingError(product);
    }

    await Product.updateOne(
      { _id: product._id, supplierVariantId: vid },
      { $set: { costPrice: liveCostPrice, price: liveRetailPrice } },
    );
    product.costPrice = liveCostPrice;
    product.price = liveRetailPrice;
  }
}

function sumOriginStock(rows) {
  const origin = getOriginCountryCode();
  return (Array.isArray(rows) ? rows : []).reduce((sum, row) => {
    if (String(row?.countryCode || "").toUpperCase() !== origin) return sum;
    return sum + Math.max(Number(row?.totalInventoryNum || 0), 0);
  }, 0);
}

async function refreshSupplierStock(lines) {
  for (const line of lines) {
    const product = line.product;
    if (product.supplier !== "cj") continue;

    const vid = String(product.supplierVariantId || "");
    if (!vid) throw createAvailabilityError(product.key, product);

    const stockRows = await getCjVariantStock(vid);
    const liveStock = sumOriginStock(stockRows);
    await Product.updateOne({ _id: product._id }, { $set: { stock: liveStock } });
    product.stock = liveStock;

    if (liveStock < line.quantity) {
      throw createAvailabilityError(product.key, product);
    }
  }
}

function buildLivePricingSummary(lines) {
  const items = lines.map((line) => {
    const unitPrice = roundMoney(line.product.price);
    const lineTotal = roundMoney(unitPrice * line.quantity);
    return {
      productKey: line.product.key,
      unitPrice,
      quantity: line.quantity,
      lineTotal,
    };
  });
  const subtotal = roundMoney(
    items.reduce((sum, item) => sum + item.lineTotal, 0),
  );
  return { items, subtotal };
}

function normalizeFreightOptions(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const basePrice = Number(row?.logisticPrice || 0);
      const totalPrice = Number(row?.totalPostageFee || 0);
      const taxes = Number(row?.taxesFee || 0);
      const clearance = Number(row?.clearanceOperationFee || 0);
      const price =
        totalPrice > 0 ? totalPrice : basePrice + taxes + clearance;

      return {
        logisticName: cleanText(row?.logisticName, 80),
        estimatedDays: cleanText(row?.logisticAging, 40),
        price: Number(Math.max(price, 0).toFixed(2)),
      };
    })
    .filter((row) => row.logisticName && Number.isFinite(row.price))
    .sort((a, b) => a.price - b.price);
}

async function calculateShipping(lines, destination, requestedLogisticName = "") {
  const cjLines = lines.filter((line) => line.product.supplier === "cj");
  if (cjLines.length === 0) {
    return {
      provider: "",
      originCountryCode: "",
      selected: { logisticName: "", estimatedDays: "", price: 0 },
      options: [],
    };
  }

  if (cjLines.length !== lines.length) {
    const error = new Error(
      "Mixed supplier carts are not supported yet. Please place Rotavoy products in a separate order.",
    );
    error.statusCode = 409;
    throw error;
  }

  const freightRows = await calculateCjFreight({
    endCountryCode: destination.countryCode,
    zip: destination.postalCode || "",
    startCountryCode: getOriginCountryCode(),
    products: cjLines.map((line) => ({
      vid: line.product.supplierVariantId,
      quantity: line.quantity,
    })),
  });

  const options = normalizeFreightOptions(freightRows);
  if (options.length === 0) {
    const error = new Error("No Rotavoy shipping method is available for this address.");
    error.statusCode = 409;
    throw error;
  }

  const requested = cleanText(requestedLogisticName, 80);
  const selected = requested
    ? options.find((option) => option.logisticName === requested)
    : options[0];

  if (!selected) {
    const error = new Error("The selected shipping method is no longer available.");
    error.statusCode = 409;
    throw error;
  }

  return {
    provider: "cj",
    originCountryCode: getOriginCountryCode(),
    selected,
    options,
  };
}

export async function getOrderShippingQuote(payload = {}) {
  const requestedItems = normalizeRequestedItems(payload.items);
  const countryCode = cleanText(payload.countryCode, 2).toUpperCase();
  const postalCode = cleanText(payload.postalCode, 20);

  if (!/^[A-Z]{2}$/.test(countryCode)) {
    const error = new Error("Country code must be a two-letter ISO code.");
    error.statusCode = 400;
    throw error;
  }

  const lines = await loadRequestedProducts(requestedItems);
  await refreshSupplierPricing(lines);
  await refreshSupplierStock(lines);

  const shippingQuote = await calculateShipping(
    lines,
    { countryCode, postalCode },
    payload.logisticName,
  );
  const pricing = buildLivePricingSummary(lines);

  return {
    ...shippingQuote,
    ...pricing,
    total: roundMoney(pricing.subtotal + Number(shippingQuote.selected?.price || 0)),
    currency: "USD",
  };
}

async function reserveRequestedProducts(
  requestedItems,
  session = null,
  orderItems = [],
) {
  for (const { productKey, quantity } of requestedItems) {
    const options = {
      returnDocument: "after",
      ...(session ? { session } : {}),
    };

    const product = await Product.findOneAndUpdate(
      {
        key: productKey,
        isActive: true,
        stock: { $gte: quantity },
      },
      { $inc: { stock: -quantity } },
      options,
    ).lean();

    if (!product) {
      const query = Product.findOne({ key: productKey, isActive: true });
      if (session) query.session(session);
      const availableProduct = await query.lean();
      throw createAvailabilityError(productKey, availableProduct);
    }

    const unitPrice = Number(product.price);
    const lineTotal = Number((unitPrice * quantity).toFixed(2));

    orderItems.push({
      productKey: product.key,
      title: product.title,
      categoryKey: product.categoryKey,
      image: product.image,
      imageUrl: product.imageUrl,
      unitPrice,
      quantity,
      lineTotal,
      supplier: product.supplier || "",
      supplierProductId: product.supplierProductId || "",
      supplierVariantId: product.supplierVariantId || "",
      supplierSku: product.supplierSku || "",
    });
  }

  return orderItems;
}

function buildOrderData({
  customer,
  paymentMethod,
  orderItems,
  shippingQuote,
}) {
  const subtotal = Number(
    orderItems.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2),
  );
  const shipping = Number(shippingQuote?.selected?.price || 0);
  const total = Number((subtotal + shipping).toFixed(2));
  const hasCjItems = orderItems.some((item) => item.supplier === "cj");

  return {
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
    logistics: {
      provider: shippingQuote?.provider || "",
      logisticName: shippingQuote?.selected?.logisticName || "",
      estimatedDays: shippingQuote?.selected?.estimatedDays || "",
      shippingCost: shipping,
      originCountryCode: shippingQuote?.originCountryCode || "",
    },
    fulfillment: {
      provider: hasCjItems ? "cj" : "none",
      status: hasCjItems ? "pending" : "not_required",
      sandbox: String(process.env.CJ_SANDBOX || "true").toLowerCase() !== "false",
      updatedAt: new Date(),
    },
    reservationExpiresAt: getReservationExpiresAt(),
    stockReserved: true,
  };
}

async function rollbackReservedProducts(orderItems) {
  if (!Array.isArray(orderItems) || orderItems.length === 0) return;

  await Product.bulkWrite(
    orderItems.map((item) => ({
      updateOne: {
        filter: { key: item.productKey },
        update: { $inc: { stock: item.quantity } },
      },
    })),
    { ordered: false },
  );
}

async function createOrderWithTransaction(input, session) {
  const orderItems = await reserveRequestedProducts(
    input.requestedItems,
    session,
  );
  const [order] = await Order.create(
    [
      buildOrderData({
        customer: input.customer,
        paymentMethod: input.paymentMethod,
        orderItems,
        shippingQuote: input.shippingQuote,
      }),
    ],
    { session },
  );
  return order;
}

async function createOrderWithCompensation(input) {
  const orderItems = [];

  try {
    await reserveRequestedProducts(input.requestedItems, null, orderItems);
    return await Order.create(
      buildOrderData({
        customer: input.customer,
        paymentMethod: input.paymentMethod,
        orderItems,
        shippingQuote: input.shippingQuote,
      }),
    );
  } catch (error) {
    try {
      await rollbackReservedProducts(orderItems);
    } catch (rollbackError) {
      console.error(
        "Could not restore reserved stock after order failure:",
        rollbackError,
      );
    }
    throw error;
  }
}

export function serializeOrder(orderDocument) {
  const order = orderDocument.toObject
    ? orderDocument.toObject()
    : orderDocument;
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
      tokenDecimals: Number.isInteger(payment.tokenDecimals)
        ? payment.tokenDecimals
        : null,
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
    logistics: order.logistics || {},
    fulfillment: order.fulfillment || {},
    reservationExpiresAt: order.reservationExpiresAt || null,
    stockReserved: Boolean(order.stockReserved),
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
      supplier: item.supplier || "",
      supplierProductId: item.supplierProductId || "",
      supplierVariantId: item.supplierVariantId || "",
      supplierSku: item.supplierSku || "",
    })),
    subtotal: order.subtotal,
    shipping: order.shipping,
    total: order.total,
    currency: order.currency,
  };
}

export async function createOrder(payload = {}) {
  const customer = normalizeCustomer(payload.customer);
  const requestedItems = normalizeRequestedItems(payload.items);
  const lines = await loadRequestedProducts(requestedItems);

  await refreshSupplierPricing(lines);
  await refreshSupplierStock(lines);

  const pricing = buildLivePricingSummary(lines);
  const hasExpectedSubtotal = payload.expectedSubtotal !== undefined && payload.expectedSubtotal !== null;
  const expectedSubtotal = Number(payload.expectedSubtotal);
  if (
    hasExpectedSubtotal &&
    Number.isFinite(expectedSubtotal) &&
    Math.abs(roundMoney(expectedSubtotal) - pricing.subtotal) >= 0.01
  ) {
    const error = new Error(
      "Product prices changed since the checkout quote. Please review the refreshed total and try again.",
    );
    error.statusCode = 409;
    throw error;
  }

  const shippingQuote = await calculateShipping(
    lines,
    {
      countryCode: customer.countryCode,
      postalCode: customer.postalCode,
    },
    payload.logisticName,
  );

  const input = {
    customer,
    paymentMethod: normalizePaymentMethod(payload.paymentMethod),
    requestedItems,
    shippingQuote,
  };

  const createdOrder = await runWithOptionalMongoTransaction({
    transaction: (session) => createOrderWithTransaction(input, session),
    fallback: () => createOrderWithCompensation(input),
  });

  return serializeOrder(createdOrder);
}
