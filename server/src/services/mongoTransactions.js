import mongoose from "mongoose";

let cachedTransactionSupport = null;

function isTransactionUnsupportedError(error) {
  const message = String(error?.message || "").toLowerCase();

  return (
    error?.code === 20 ||
    message.includes("transaction numbers are only allowed on a replica set member or mongos") ||
    message.includes("transactions are not supported")
  );
}

export async function supportsMongoTransactions() {
  if (typeof cachedTransactionSupport === "boolean") {
    return cachedTransactionSupport;
  }

  const topologyType = mongoose.connection?.client?.topology?.description?.type;

  if (["ReplicaSetWithPrimary", "ReplicaSetNoPrimary", "Sharded"].includes(topologyType)) {
    cachedTransactionSupport = true;
    return true;
  }

  if (topologyType === "Single") {
    cachedTransactionSupport = false;
    return false;
  }

  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    cachedTransactionSupport = Boolean(hello?.setName || hello?.msg === "isdbgrid");
  } catch (error) {
    console.warn("Could not detect MongoDB transaction support; using safe fallback.", error);
    cachedTransactionSupport = false;
  }

  return cachedTransactionSupport;
}

export async function runWithOptionalMongoTransaction({ transaction, fallback }) {
  if (!(await supportsMongoTransactions())) {
    return fallback();
  }

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      result = await transaction(session);
    });

    return result;
  } catch (error) {
    if (isTransactionUnsupportedError(error)) {
      cachedTransactionSupport = false;
      return fallback();
    }

    throw error;
  } finally {
    await session.endSession();
  }
}
