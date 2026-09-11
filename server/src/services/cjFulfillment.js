import { Order } from "../models/Order.js";
import { createCjOrder, isCjConfigured } from "./cjApi.js";

function getSandboxFlag() {
  return String(process.env.CJ_SANDBOX || "true").toLowerCase() !== "false" ? 1 : 0;
}

function getOriginCountryCode() {
  return String(process.env.CJ_FROM_COUNTRY_CODE || "CN").toUpperCase();
}

function getCjItems(order) {
  return (order.items || []).filter(
    (item) => item.supplier === "cj" && item.supplierVariantId,
  );
}

export async function fulfillPaidOrder(orderDocument) {
  const order = orderDocument?.toObject ? orderDocument.toObject() : orderDocument;
  if (!order || order.paymentStatus !== "paid") return orderDocument;

  const cjItems = getCjItems(order);
  if (cjItems.length === 0) return orderDocument;

  if (!isCjConfigured()) {
    await Order.updateOne(
      { _id: order._id },
      {
        $set: {
          "fulfillment.provider": "cj",
          "fulfillment.status": "failed",
          "fulfillment.error": "CJ_API_KEY is not configured.",
          "fulfillment.updatedAt": new Date(),
        },
      },
    );
    return Order.findById(order._id);
  }

  const claim = await Order.findOneAndUpdate(
    {
      _id: order._id,
      paymentStatus: "paid",
      "fulfillment.status": { $in: ["pending", "failed"] },
    },
    {
      $set: {
        "fulfillment.provider": "cj",
        "fulfillment.status": "submitting",
        "fulfillment.error": "",
        "fulfillment.updatedAt": new Date(),
      },
    },
    { new: true },
  );

  if (!claim) return Order.findById(order._id);

  try {
    const customer = claim.customer || {};
    const logistics = claim.logistics || {};
    const result = await createCjOrder({
      orderNumber: claim.orderNumber,
      shippingZip: customer.postalCode || "",
      shippingCountryCode: customer.countryCode,
      shippingCountry: customer.country,
      shippingProvince: customer.province,
      shippingCity: customer.city,
      shippingPhone: customer.phone,
      shippingCustomerName: customer.fullName,
      shippingAddress: customer.address,
      email: customer.email,
      remark: customer.note || "",
      payType: 2,
      logisticName: logistics.logisticName,
      fromCountryCode: getOriginCountryCode(),
      platform: "Api",
      orderFlow: 1,
      isSandbox: getSandboxFlag(),
      products: cjItems.map((item) => ({
        vid: item.supplierVariantId,
        sku: item.supplierSku || undefined,
        quantity: item.quantity,
        storeProductId: item.productKey,
        storeProductImg: item.imageUrl || undefined,
        storeLineItemId: `${claim.orderNumber}-${item.productKey}`.slice(0, 125),
      })),
    });

    return Order.findByIdAndUpdate(
      claim._id,
      {
        $set: {
          status: "processing",
          "fulfillment.provider": "cj",
          "fulfillment.status": "submitted",
          "fulfillment.externalOrderId": String(result?.orderId || ""),
          "fulfillment.shipmentOrderId": String(result?.shipmentOrderId || ""),
          "fulfillment.externalOrderNumber": String(result?.orderNumber || ""),
          "fulfillment.error": "",
          "fulfillment.sandbox": Boolean(getSandboxFlag()),
          "fulfillment.submittedAt": new Date(),
          "fulfillment.updatedAt": new Date(),
        },
      },
      { new: true },
    );
  } catch (error) {
    await Order.updateOne(
      { _id: claim._id },
      {
        $set: {
          "fulfillment.provider": "cj",
          "fulfillment.status": "failed",
          "fulfillment.error": String(error.message || "CJ fulfillment failed.").slice(0, 1000),
          "fulfillment.updatedAt": new Date(),
        },
      },
    );

    return Order.findById(claim._id);
  }
}
