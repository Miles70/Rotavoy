import "dotenv/config";
import {
  getNuiteeStatus,
  prebookNuiteeRate,
  searchNuiteeRates,
} from "../services/nuiteeApi.js";

const suppliedOfferId = String(process.argv[2] || "").trim();
const status = getNuiteeStatus();

console.log(
  `[Nuitee] configured=${status.configured} environment=${status.environment}`,
);

if (!status.configured) {
  console.error("NUITEE_API_KEY is not configured in server/.env.");
  process.exit(1);
}

if (status.environment !== "sandbox") {
  console.error(
    "Refusing to run Payment SDK probe outside sandbox. Use a sand_ Nuitee API key.",
  );
  process.exit(1);
}

const interestingKeys = new Set([
  "secretKey",
  "transactionId",
  "paymentIntent",
  "clientSecret",
  "prebookId",
]);

function findInterestingFields(value, path = "root", found = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      findInterestingFields(item, `${path}[${index}]`, found),
    );
    return found;
  }

  if (!value || typeof value !== "object") return found;

  for (const [key, nested] of Object.entries(value)) {
    const currentPath = `${path}.${key}`;
    if (interestingKeys.has(key)) {
      found.push({
        field: key,
        path: currentPath,
        present: nested !== undefined && nested !== null && String(nested).length > 0,
      });
    }
    findInterestingFields(nested, currentPath, found);
  }

  return found;
}

function isoDateFromNow(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function resolveOfferId() {
  if (suppliedOfferId) {
    console.log("Using offerId supplied on the command line.");
    return suppliedOfferId;
  }

  const checkin = isoDateFromNow(7);
  const checkout = isoDateFromNow(9);

  console.log(
    `No offerId supplied. Searching a sandbox Antalya stay for ${checkin} -> ${checkout}...`,
  );

  const rates = await searchNuiteeRates({
    countryCode: "TR",
    cityName: "Antalya",
    checkin,
    checkout,
    currency: "USD",
    guestNationality: "TR",
    occupancies: [{ adults: 2 }],
    margin: 15,
    includeHotelData: true,
    roomMapping: true,
    maxRatesPerHotel: 3,
    limit: 20,
    timeout: 10,
  });

  for (const hotel of rates?.data || []) {
    for (const room of hotel?.roomTypes || []) {
      const offerId = String(room?.offerId || "").trim();
      if (offerId) {
        console.log(
          `Found sandbox offer${hotel?.name ? ` at ${hotel.name}` : ""}.`,
        );
        return offerId;
      }
    }
  }

  throw new Error(
    "No sandbox offerId was found automatically. Search a hotel in Rotavoy and pass an offerId manually.",
  );
}

try {
  const offerId = await resolveOfferId();

  console.log("Sending prebook with usePaymentSdk=true...");

  const result = await prebookNuiteeRate({
    offerId,
    usePaymentSdk: true,
  });

  const fields = findInterestingFields(result);
  const present = Object.fromEntries(
    [...interestingKeys].map((key) => [
      key,
      fields.some((entry) => entry.field === key && entry.present),
    ]),
  );

  console.log("\nPayment SDK probe succeeded.");
  console.log(
    JSON.stringify(
      {
        requestAccepted: true,
        usePaymentSdk: true,
        fieldsPresent: present,
        fieldPaths: fields.map(({ field, path, present: isPresent }) => ({
          field,
          path,
          present: isPresent,
        })),
      },
      null,
      2,
    ),
  );

  if (present.secretKey || present.clientSecret || present.paymentIntent) {
    console.log("\nRESULT: Payment SDK credentials are being returned by Nuitee.");
  } else if (present.transactionId || present.prebookId) {
    console.log(
      "\nRESULT: Prebook works, but no Payment SDK credential field was detected.",
    );
  } else {
    console.log(
      "\nRESULT: Request succeeded, but expected prebook/payment fields were not detected.",
    );
  }
} catch (error) {
  console.error("\nPayment SDK probe failed.");
  console.error(
    JSON.stringify(
      {
        message: String(error?.message || "Unknown error"),
        statusCode: error?.statusCode || null,
        upstreamStatus: error?.upstreamStatus || null,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}
