import { useEffect, useState } from "react";

export function useBookingAvailability() {
  const [availability, setAvailability] = useState(null);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const base = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
    fetch(`${base}/api/hotels/status`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unavailable");
        return response.json();
      })
      .then((value) => active && setAvailability({
        card: value.cardBookingEnabled === true,
        crypto: value.cryptoBookingEnabled === true,
      }))
      .catch(() => { if (active) setAvailability({ card: false, crypto: false }); })
      .finally(() => clearTimeout(timer));
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, []);
  return availability;
}
