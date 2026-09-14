import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedCjVideoUrl } from "../src/routes/productMedia.js";

test("product video proxy accepts only HTTPS CJ media hosts", () => {
  assert.equal(
    isAllowedCjVideoUrl("https://download-only-api.cjdropshipping.com/video.mp4"),
    true,
  );
  assert.equal(isAllowedCjVideoUrl("http://cjdropshipping.com/video.mp4"), false);
  assert.equal(isAllowedCjVideoUrl("https://cjdropshipping.com.example.com/video.mp4"), false);
  assert.equal(isAllowedCjVideoUrl("https://example.com/video.mp4"), false);
});
