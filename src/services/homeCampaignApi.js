const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export async function getHomeCampaign(language = "en") {
  const params = new URLSearchParams();
  if (language) params.set("language", language);

  const query = params.toString();
  const response = await fetch(`${apiBaseUrl}/api/campaign${query ? `?${query}` : ""}`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Campaign could not be loaded.");
  }

  return data;
}
