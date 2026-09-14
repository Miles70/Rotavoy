import assert from "node:assert/strict";
import test from "node:test";
import { selectCjProductVideo } from "../src/services/cjProductVideo.js";

test("CJ video selection accepts only usable listed CJ-hosted media", () => {
  const selected = selectCjProductVideo([
    { videoState: "DOWN_STATE", isFree: "1", videoUrl: "https://download-only-api.cjdropshipping.com/down.mp4" },
    { videoState: "ON_STATE", isFree: "0", isBuy: false, videoUrl: "https://download-only-api.cjdropshipping.com/paid.mp4" },
    {
      videoState: "ON_STATE",
      isFree: "1",
      videoUrl: "https://download-only-api.cjdropshipping.com/video.mp4",
      coverURL: "https://download-only-api.cjdropshipping.com/cover.jpg",
    },
  ]);

  assert.equal(selected.hasVideo, true);
  assert.equal(selected.videoUrl, "https://download-only-api.cjdropshipping.com/video.mp4");
  assert.equal(selected.videoPosterUrl, "https://download-only-api.cjdropshipping.com/cover.jpg");
});

test("CJ video selection rejects external media hosts", () => {
  assert.deepEqual(selectCjProductVideo([
    { videoState: "ON_STATE", isFree: "1", videoUrl: "https://example.com/video.mp4" },
  ]), { videoUrl: "", videoPosterUrl: "", hasVideo: false });
});
