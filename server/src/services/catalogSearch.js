const SEARCH_ALIASES = {
  telefon: ["telefon", "phone", "mobile", "smartphone"],
  phone: ["phone", "telefon", "mobile", "smartphone"],
  mobile: ["mobile", "telefon", "phone", "smartphone"],
  kilif: ["kılıf", "kılıfı", "kilif", "kilifi", "case", "cover"],
  case: ["case", "cover", "kılıf", "kilif"],
  sarj: ["şarj", "sarj", "charger", "charging"],
  charger: ["charger", "charging", "şarj", "sarj"],
  kulaklik: ["kulaklık", "kulaklik", "earphone", "earphones", "headphone", "headphones", "earbuds"],
  ayakkabi: ["ayakkabı", "ayakkabi", "shoe", "shoes", "sneaker", "sneakers"],
  canta: ["çanta", "canta", "bag", "backpack", "handbag"],
  saat: ["saat", "watch", "smartwatch"],
  mutfak: ["mutfak", "kitchen"],
  oyuncak: ["oyuncak", "toy", "toys"],
  bebek: ["bebek", "baby"],
  kopek: ["köpek", "kopek", "dog"],
  kedi: ["kedi", "cat"],
};

const STOP_WORDS = new Set(["bir", "ve", "ile", "icin", "için", "the", "and", "for"]);

function asciiFold(value) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("ß", "ss");
}

function stems(token) {
  const values = new Set([token]);
  for (const suffix of ["lari", "leri", "lar", "ler", "ini", "ını", "unu", "ünü", "si", "sı", "su", "sü", "i", "ı", "u", "ü", "s"]) {
    if (token.length - suffix.length >= 4 && token.endsWith(asciiFold(suffix))) {
      values.add(token.slice(0, -asciiFold(suffix).length));
    }
  }
  return [...values];
}

export function getCatalogSearchTermGroups(search) {
  const tokens = String(search || "")
    .trim()
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !STOP_WORDS.has(asciiFold(token)))
    .slice(0, 8);

  return tokens.map((token) => {
    const normalizedStems = stems(asciiFold(token));
    const aliases = normalizedStems.flatMap((stem) => SEARCH_ALIASES[stem] || []);
    return [...new Set([token, ...normalizedStems, ...aliases])].filter((value) => value.length >= 2);
  });
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildCatalogSearchConditions(search, fields) {
  const safeFields = [...new Set(fields.filter(Boolean))];
  return getCatalogSearchTermGroups(search).map((terms) => ({
    $or: terms.flatMap((term) => {
      const pattern = new RegExp(escapeRegex(term), "i");
      return safeFields.map((field) => ({ [field]: pattern }));
    }),
  }));
}
