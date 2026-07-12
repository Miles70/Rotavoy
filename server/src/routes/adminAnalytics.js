import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { Order } from "../models/Order.js";

export const adminAnalyticsRouter = Router();

const orderStatuses = ["pending", "processing", "shipped", "completed", "cancelled"];

function startOfUtcDay(daysAgo = 0) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date;
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

adminAnalyticsRouter.use(requireAdmin);

adminAnalyticsRouter.get("/", async (request, response, next) => {
  try {
    const startDate = startOfUtcDay(6);
    const [dailyOrders, statusCounts] = await Promise.all([
      Order.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
                timezone: "UTC",
              },
            },
            orders: { $sum: 1 },
            paidRevenue: {
              $sum: {
                $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$total", 0],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const dailyMap = new Map(dailyOrders.map((item) => [item._id, item]));
    const orderTrend = Array.from({ length: 7 }, (_, index) => {
      const date = startOfUtcDay(6 - index);
      const key = toDateKey(date);
      const item = dailyMap.get(key);

      return {
        date: key,
        orders: item?.orders || 0,
        paidRevenue: item?.paidRevenue || 0,
      };
    });

    const statusMap = new Map(statusCounts.map((item) => [item._id, item.count]));
    const statusBreakdown = orderStatuses.map((status) => ({
      status,
      count: statusMap.get(status) || 0,
    }));

    response.json({ orderTrend, statusBreakdown });
  } catch (error) {
    next(error);
  }
});
