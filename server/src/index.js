import "dotenv/config";
import { createApp } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";

import { startBookingReconciliation } from "./services/bookingReconciliation.js";

const port = Number(process.env.PORT) || 5000;
const app = createApp();
let server;
let stopReconciliation;

async function startServer() {
  await connectDatabase();

  stopReconciliation = startBookingReconciliation();
  server = app.listen(port, () => {
    console.log(`Rotavoy Travel API running on http://localhost:${port}`);
  });
}

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);

  stopReconciliation?.();
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
