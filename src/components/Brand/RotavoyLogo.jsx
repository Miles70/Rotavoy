import { useEffect, useRef } from "react";
import "./RotavoyLogo.css";

const SOURCE = "/rotavoy-source-logo.png?v=20261004-source";
const SOURCE_SYMBOL = { x: 236, y: 127, width: 791, height: 816 };
const SOURCE_WORDMARK = { x: 128, y: 970, width: 1003, height: 224 };
const OUTPUT = { width: 1220, height: 360 };

let processedSourcePromise;

function isEdgeWhite(data, pixelIndex) {
  const offset = pixelIndex * 4;
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  return r >= 238 && g >= 238 && b >= 238;
}

function removeConnectedWhiteBackground(canvas) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const { width, height } = canvas;
  const image = context.getImageData(0, 0, width, height);
  const data = image.data;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const enqueue = (index) => {
    if (visited[index] || !isEdgeWhite(data, index)) return;
    visited[index] = 1;
    queue[tail] = index;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }

  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head];
    head += 1;

    data[index * 4 + 3] = 0;

    const x = index % width;
    const y = Math.floor(index / width);

    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }

  context.putImageData(image, 0, 0);
  return canvas;
}

function getProcessedSource() {
  if (processedSourcePromise) return processedSourcePromise;

  processedSourcePromise = new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      resolve(removeConnectedWhiteBackground(canvas));
    };
    image.onerror = reject;
    image.src = SOURCE;
  });

  return processedSourcePromise;
}

function drawHorizontalLogo(canvas, source) {
  const context = canvas.getContext("2d");
  canvas.width = OUTPUT.width;
  canvas.height = OUTPUT.height;
  context.clearRect(0, 0, OUTPUT.width, OUTPUT.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const symbolHeight = 340;
  const symbolWidth = Math.round(
    (SOURCE_SYMBOL.width / SOURCE_SYMBOL.height) * symbolHeight,
  );
  const symbolY = Math.round((OUTPUT.height - symbolHeight) / 2);

  context.drawImage(
    source,
    SOURCE_SYMBOL.x,
    SOURCE_SYMBOL.y,
    SOURCE_SYMBOL.width,
    SOURCE_SYMBOL.height,
    0,
    symbolY,
    symbolWidth,
    symbolHeight,
  );

  const wordmarkHeight = 156;
  const wordmarkWidth = Math.round(
    (SOURCE_WORDMARK.width / SOURCE_WORDMARK.height) * wordmarkHeight,
  );
  const wordmarkX = symbolWidth + 34;
  const wordmarkY = Math.round((OUTPUT.height - wordmarkHeight) / 2) + 8;

  context.drawImage(
    source,
    SOURCE_WORDMARK.x,
    SOURCE_WORDMARK.y,
    SOURCE_WORDMARK.width,
    SOURCE_WORDMARK.height,
    wordmarkX,
    wordmarkY,
    wordmarkWidth,
    wordmarkHeight,
  );
}

function canvasClassForImage(image) {
  if (image.closest(".travelBrandBlock")) return "heroRotavoyLogo";
  if (image.closest(".footerLogo")) return "footerRotavoyLogo";
  return "headerRotavoyLogo";
}

function upgradeApprovedLogoImages(source) {
  document.querySelectorAll("img.approvedLogo").forEach((image) => {
    if (image.dataset.rotavoyUpgraded === "true") return;

    const canvas = document.createElement("canvas");
    canvas.className = `rotavoyLogoCanvas ${canvasClassForImage(image)}`;
    canvas.width = OUTPUT.width;
    canvas.height = OUTPUT.height;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", image.alt || "Rotavoy");
    drawHorizontalLogo(canvas, source);

    image.dataset.rotavoyUpgraded = "true";
    image.style.display = "none";
    image.insertAdjacentElement("afterend", canvas);
  });
}

function RotavoyLogo({ className = "", alt = "Rotavoy" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let observer;

    getProcessedSource()
      .then((source) => {
        if (cancelled) return;

        if (canvasRef.current) {
          drawHorizontalLogo(canvasRef.current, source);
        }

        upgradeApprovedLogoImages(source);
        observer = new MutationObserver(() => upgradeApprovedLogoImages(source));
        observer.observe(document.body, { childList: true, subtree: true });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`rotavoyLogoCanvas ${className}`.trim()}
      width={OUTPUT.width}
      height={OUTPUT.height}
      role="img"
      aria-label={alt}
    />
  );
}

export default RotavoyLogo;
