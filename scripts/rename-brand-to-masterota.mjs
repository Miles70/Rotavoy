import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const ignoredDirectories = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  "coverage",
]);
const ignoredFiles = new Set([
  "scripts/rename-brand-to-masterota.mjs",
  ".github/workflows/rename-brand-to-masterota.yml",
]);
const textExtensions = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".json",
  ".html",
  ".css",
  ".scss",
  ".md",
  ".txt",
  ".yml",
  ".yaml",
  ".env",
  ".example",
  ".svg",
]);
const extensionlessTextFiles = new Set([
  ".gitignore",
  ".npmrc",
  "Dockerfile",
]);

const protectedFirebaseValues = new Map([
  ["gabaloo-219b1.firebaseapp.com", "__MASTEROTA_FIREBASE_AUTH_DOMAIN__"],
  ["gabaloo-219b1.firebasestorage.app", "__MASTEROTA_FIREBASE_STORAGE_BUCKET__"],
  ["gabaloo-219b1", "__MASTEROTA_FIREBASE_PROJECT_ID__"],
]);

function isTextFile(relativePath) {
  const basename = path.basename(relativePath);
  return extensionlessTextFiles.has(basename) || textExtensions.has(path.extname(relativePath));
}

async function collectFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.relative(root, absolutePath).replaceAll(path.sep, "/");

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolutePath)));
      continue;
    }

    if (!ignoredFiles.has(relativePath) && isTextFile(relativePath)) {
      files.push({ absolutePath, relativePath });
    }
  }

  return files;
}

function replaceBrand(content, relativePath) {
  let nextContent = content;

  for (const [value, placeholder] of protectedFirebaseValues) {
    nextContent = nextContent.replaceAll(value, placeholder);
  }

  nextContent = nextContent
    .replaceAll("GABALOO", "MASTEROTA")
    .replaceAll("Gabaloo", "Masterota")
    .replaceAll("gabaloo", "masterota");

  for (const [value, placeholder] of protectedFirebaseValues) {
    nextContent = nextContent.replaceAll(placeholder, value);
  }

  if (relativePath === "src/components/Header/Header.jsx") {
    nextContent = nextContent
      .replace(
        '<span className="logoTextCore">Gaba</span>',
        '<span className="logoTextCore">Master</span>',
      )
      .replace(
        '<span className="logoTextAccent">loo</span>',
        '<span className="logoTextAccent">ota</span>',
      )
      .replace(
        'd="M34 15.5C31.2 12.6 27.9 11 23.6 11C16 11 10.5 16.4 10.5 24S16 37 23.6 37C27.9 37 31.5 35.5 34.4 32.8V25H24"',
        'd="M10.5 36.5V11.5L24 27L37.5 11.5V36.5"',
      );
  }

  if (relativePath === "src/config/site.js") {
    nextContent = nextContent
      .replace('shortName: "G"', 'shortName: "M"')
      .replace(
        'description: "Premium online shopping experience."',
        'description: "Shop, Travel, Discover."',
      );
  }

  if (relativePath === "src/config/wagmi.js") {
    nextContent = nextContent.replace(
      'description: "Global commerce powered by Web3."',
      'description: "Shop, travel and discover with Web3."',
    );
  }

  if (relativePath === "src/layouts/AdminLayout.jsx") {
    nextContent = nextContent.replace(
      '<div className="admin-brand-mark">G</div>',
      '<div className="admin-brand-mark">M</div>',
    );
  }

  if (
    relativePath === "server/src/index.js" ||
    relativePath === "server/src/services/orderNumberMigration.js" ||
    relativePath === "server/src/services/orderService.js"
  ) {
    nextContent = nextContent.replaceAll("GBL", "MTR");
  }

  return nextContent;
}

const files = await collectFiles(root);
let changedFiles = 0;

for (const { absolutePath, relativePath } of files) {
  const content = await fs.readFile(absolutePath, "utf8");
  const nextContent = replaceBrand(content, relativePath);

  if (nextContent !== content) {
    await fs.writeFile(absolutePath, nextContent, "utf8");
    changedFiles += 1;
    console.log(`Updated ${relativePath}`);
  }
}

await fs.rm(path.join(root, "scripts/rename-brand-to-masterota.mjs"), { force: true });
await fs.rm(path.join(root, ".github/workflows/rename-brand-to-masterota.yml"), { force: true });

console.log(`Masterota migration completed. ${changedFiles} files updated.`);
