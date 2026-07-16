import mongoose from "mongoose";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";

const DEFAULT_SWEEP_LIMIT = 100;

function normalizeLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_SWEEP_LIMIT;
  return Math.min(parsed, 500);
}

export async function releaseOrderStock(
  orderOrId,
  {
    status = "expired",
    paymentStatus = "failed",
  } = {},
) {
  const orderId = orderOrId?._id || orderOrId;
  if (!orderId) return null;

  const session = await mongoose.startSession();
  let releasedOrder = null;

  try {
    await session.withTransaction(async () => {
      releasedOrder = await Order.findOneAndUpdate(
        {
          _id: orderId,
          stockReserved: true,
          stockReleasedAt: null,
          stockCommittedAt: null,
          paymentStatus: { $ne: "paid" },
        },
        {
          $set: {
            status,
            paymentStatus,
            stockReserved: false,
            stockReleasedAt: new Date(),
            reservationExpiresAt: null,
          },
        },
        {
          new: true,
          runValidators: true,
          session,
        },
      );

      if (!releasedOrder) return;

      const operations = releasedOrder.items.map((item) => ({
        updateOne: {
          filter: { key: item.productKey },
          update: { $inc: { stock: item.quantity } },
        },
      }));

      if (operations.length > 0) {
        await Product.bulkWrite(operations, {
          ordered: false,
          session,
        });
      }
    });

    return releasedOrder;
  } finally {
    await session.endSession();
  }
}

export async function releaseExpiredOrderReservations({
  limit = DEFAULT_SWEEP_LIMIT,
} = {}) {
  const expiredOrders = await Order.find({
    stockReserved: true,
    stockReleasedAt: null,
    stockCommittedAt: null,
    paymentStatus: { $ne: "paid" },
    reservationExpiresAt: { $ne: null, $lte: new Date() },
  })
    .select({ _id: 1 })
    .sort({ reservationExpiresAt: 1 })
    .limit(normalizeLimit(limit))
    .lean();

  let releasedCount = 0;

  for (const order of expiredOrders) {
    const releasedOrder = await releaseOrderStock(order._id);

    if (releasedOrder) {
      releasedCount += 1;
    }
  }

  return {
    checkedCount: expiredOrders.length,
    releasedCount,
  };
}
