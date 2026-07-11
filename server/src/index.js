import "dotenv/config";
import { createApp } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { syncProductsFromCatalog } from "./services/productSync.js";

const port = Number(process.env.PORT) || 5000;
const app = createApp();
let server;

async function startServer() {
  await connectDatabase();

  if (String(process.env.AUTO_SEED_PRODUCTS || "true").toLowerCase() === "true") {
    const result = await syncProductsFromCatalog();
    console.log(
      `Product catalog synced: ${result.modifiedCount || 0} updated, ${result.upsertedCount || 0} created.`
    );
  }

  server = app.listen(port, () => {
    console.log(`Kemalreis API running on http://localhost:${port}`);
  });
}

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  await disconnectDatabase();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

startServer().catch((error) => {
  console.error("Server could not start:", error);
  process.exit(1);
});
