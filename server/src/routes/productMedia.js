import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Router } from "express";
import { Product } from "../models/Product.js";

export const productMediaRouter = Router();

export function isAllowedCjVideoUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    const hostname = url.hostname.toLowerCase();
    return url.protocol === "https:" &&
      (hostname === "cjdropshipping.com" || hostname.endsWith(".cjdropshipping.com"));
  } catch {
    return false;
  }
}

productMediaRouter.get("/:productKey/video", async (request, response, next) => {
  const controller = new AbortController();
  request.on("aborted", () => controller.abort());
  response.on("close", () => {
    if (!response.writableEnded) controller.abort();
  });

  try {
    const product = await Product.findOne({
      key: request.params.productKey,
      isActive: true,
      hasVideo: true,
      videoUrl: { $ne: "" },
    })
      .select({ videoUrl: 1 })
      .lean();

    if (!product || !isAllowedCjVideoUrl(product.videoUrl)) {
      return response.status(404).json({ message: "Product video not found." });
    }

    const upstream = await fetch(product.videoUrl, {
      signal: controller.signal,
      headers: {
        Referer: "https://developers.cjdropshipping.com/",
        Accept: "video/*",
        ...(request.headers.range ? { Range: request.headers.range } : {}),
      },
    });

    if (!upstream.ok || !upstream.body) {
      const error = new Error(`CJ video request failed with ${upstream.status}.`);
      error.statusCode = 502;
      throw error;
    }

    response.status(upstream.status);
    for (const header of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const value = upstream.headers.get(header);
      if (value) response.setHeader(header, value);
    }
    response.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");

    await pipeline(Readable.fromWeb(upstream.body), response);
    return undefined;
  } catch (error) {
    if (error.name === "AbortError" || response.destroyed) return undefined;
    return next(error);
  }
});
