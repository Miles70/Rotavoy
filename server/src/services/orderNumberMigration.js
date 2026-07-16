import { Order } from "../models/Order.js";

const LEGACY_PREFIXES = ["KMR-", "GBL-", "MTR-"];
const CURRENT_PREFIX = "RTV-";

function getOrderSuffix(orderNumber, prefix) {
  return orderNumber.slice(prefix.length);
}

export function getCompatibleOrderNumbers(value) {
  const orderNumber = String(value || "").trim().toUpperCase();

  if (!orderNumber) return [];

  const matchedLegacyPrefix = LEGACY_PREFIXES.find((prefix) =>
    orderNumber.startsWith(prefix),
  );

  if (matchedLegacyPrefix) {
    const suffix = getOrderSuffix(orderNumber, matchedLegacyPrefix);

    return [
      orderNumber,
      `${CURRENT_PREFIX}${suffix}`,
      ...LEGACY_PREFIXES.filter((prefix) => prefix !== matchedLegacyPrefix).map(
        (prefix) => `${prefix}${suffix}`,
      ),
    ];
  }

  if (orderNumber.startsWith(CURRENT_PREFIX)) {
    const suffix = getOrderSuffix(orderNumber, CURRENT_PREFIX);

    return [
      orderNumber,
      ...LEGACY_PREFIXES.map((prefix) => `${prefix}${suffix}`),
    ];
  }

  return [orderNumber];
}

export async function migrateLegacyOrderNumbers() {
  const legacyOrders = await Order.find({
    orderNumber: /^(KMR|GBL|MTR)-/i,
  })
    .select({ _id: 1, orderNumber: 1 })
    .lean();

  if (legacyOrders.length === 0) {
    return { modifiedCount: 0, skippedCount: 0 };
  }

  const operations = [];
  let skippedCount = 0;

  for (const order of legacyOrders) {
    const currentOrderNumber = String(order.orderNumber || "").replace(
      /^(KMR|GBL|MTR)-/i,
      CURRENT_PREFIX,
    );

    const duplicateExists = await Order.exists({
      _id: { $ne: order._id },
      orderNumber: currentOrderNumber,
    });

    if (duplicateExists) {
      skippedCount += 1;
      continue;
    }

    operations.push({
      updateOne: {
        filter: {
          _id: order._id,
          orderNumber: order.orderNumber,
        },
        update: {
          $set: { orderNumber: currentOrderNumber },
        },
      },
    });
  }

  if (operations.length === 0) {
    return { modifiedCount: 0, skippedCount };
  }

  const result = await Order.bulkWrite(operations, { ordered: false });

  return {
    modifiedCount: result.modifiedCount || 0,
    skippedCount,
  };
}
