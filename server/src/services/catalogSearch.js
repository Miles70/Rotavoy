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

function getDetailedSearchTermGroups(search) {
  return getCatalogSearchTermGroups(search).map((terms) => {
    const directSet = new Set([terms[0], ...stems(asciiFold(terms[0]))]);
    const directTerms = terms.filter((term) => directSet.has(term));

    return {
      terms,
      directTerms: directTerms.length ? directTerms : terms.slice(0, 1),
      aliasTerms: terms.filter((term) => !directTerms.includes(term)),
    };
  });
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function exactWordPattern(term) {
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(term)}([^\\p{L}\\p{N}]|$)`, "iu");
}

function isStrongSearchField(field) {
  return /(^|\.)(key|title|brand|categoryKey|categoryLabel)$/.test(field);
}

export function buildCatalogSearchConditions(search, fields) {
  const safeFields = [...new Set(fields.filter(Boolean))];
  const strongFields = safeFields.filter(isStrongSearchField);

  return getDetailedSearchTermGroups(search).map(({ directTerms, aliasTerms }) => ({
    $or: [
      ...directTerms.flatMap((term) => {
        const pattern = exactWordPattern(term);
        return strongFields.map((field) => ({ [field]: pattern }));
      }),
      ...aliasTerms.flatMap((term) => {
        const pattern = exactWordPattern(term);
        return strongFields.map((field) => ({ [field]: pattern }));
      }),
    ],
  }));
}

export function buildCatalogSearchExclusions(search, fields) {
  const normalizedTerms = getCatalogSearchTermGroups(search)
    .flat()
    .map(asciiFold);
  const titleFields = [...new Set(fields.filter((field) => /(^|\.)title$/.test(field)))];
  const exclusions = [];

  if (normalizedTerms.some((term) => ["kilif", "kilifi", "case", "cover"].includes(term))) {
    const negativeCase = /(kılıfsız|kilifsiz|without\s+(?:a\s+)?case|no\s+case|case[-\s]?less)/iu;
    exclusions.push(...titleFields.map((field) => ({ [field]: negativeCase })));
  }

  return exclusions;
}
