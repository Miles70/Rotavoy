import { Order } from "../models/Order.js";

const LEGACY_PREFIX = "KMR-";
const CURRENT_PREFIX = "MTR-";

export function getCompatibleOrderNumbers(value) {
  const orderNumber = String(value || "").trim().toUpperCase();

  if (!orderNumber) return [];

  if (orderNumber.startsWith(LEGACY_PREFIX)) {
    return [
      orderNumber,
      `${CURRENT_PREFIX}${orderNumber.slice(LEGACY_PREFIX.length)}`,
    ];
  }

  if (orderNumber.startsWith(CURRENT_PREFIX)) {
    return [
      orderNumber,
      `${LEGACY_PREFIX}${orderNumber.slice(CURRENT_PREFIX.length)}`,
    ];
  }

  return [orderNumber];
}

export async function migrateLegacyOrderNumbers() {
  const legacyOrders = await Order.find({
    orderNumber: /^KMR-/i,
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
      /^KMR-/i,
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
