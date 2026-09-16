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
  canta: ["çanta", "çantalar", "canta", "cantalar", "bag", "bags", "backpack", "backpacks", "handbag", "handbags"],
  saat: ["saat", "watch", "smartwatch"],
  mutfak: ["mutfak", "kitchen"],
  oyuncak: ["oyuncak", "toy", "toys"],
  bebek: ["bebek", "baby"],
  kopek: ["köpek", "kopek", "dog"],
  kedi: ["kedi", "cat"],
};

const STOP_WORDS = new Set(["bir", "ve", "ile", "icin", "için", "the", "and", "for"]);

const SEARCH_PRODUCT_PROFILES = [
  {
    terms: ["ayakkabi", "shoe", "shoes", "sneaker", "sneakers"],
    categoryKeys: ["fashion"],
    accessoryTerms: [
      "bag", "bags", "backpack", "handbag", "pouch", "luggage", "suitcase", "case",
      "organizer", "storage", "holder", "rack", "cabinet", "box", "cover", "dryer",
      "washer", "brush", "horn", "charm", "canta", "çanta", "bavul", "valiz", "kese",
      "saklama", "düzenleyici", "duzenleyici", "dolap", "raf", "rafı", "rafi", "kutusu", "kutu", "kılıf",
      "kilif", "fırça", "firca", "kurutucu", "yıkama", "yikama",
      "bolsa", "mochila", "maleta", "organizador", "almacenamiento",
      "sac", "valise", "organisateur", "rangement", "armoire",
      "tasche", "rucksack", "koffer", "aufbewahrung", "schrank",
      "borsa", "zaino", "valigia", "organizzatore", "contenitore",
      "сумка", "рюкзак", "чемодан", "органайзер", "хранение", "шкаф",
      "حقيبة", "منظم", "تخزين", "خزانة", "包", "收纳", "鞋柜",
    ],
  },
  {
    terms: ["kilif", "kilifi", "case", "cover"],
    categoryKeys: ["electronics", "mobile"],
    negativePattern: /(kılıfsız|kilifsiz|without\s+(?:a\s+)?case|no\s+case|case[-\s]?less)/iu,
  },
];

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

export function buildCatalogProductTypeCondition(search, fields) {
  const termGroups = getDetailedSearchTermGroups(search);
  const productTypeTerms = termGroups.at(-1);
  if (!productTypeTerms) return null;

  const safeFields = [...new Set(fields.filter(Boolean))];
  const categoryFields = safeFields.filter((field) => /(^|\.)categoryLabel$/.test(field));
  const titleFields = safeFields.filter((field) => /(^|\.)title$/.test(field));
  const terms = [...productTypeTerms.directTerms, ...productTypeTerms.aliasTerms];
  const matchesAnyField = (targetFields) => ({
    $or: terms.flatMap((term) => {
      const pattern = exactWordPattern(term);
      return targetFields.map((field) => ({ [field]: pattern }));
    }),
  });

  if (!categoryFields.length) return matchesAnyField(titleFields);

  return {
    $or: [
      matchesAnyField(categoryFields),
      {
        $and: [
          {
            $or: [
              { categoryLabel: { $exists: false } },
              { categoryLabel: "" },
              { categoryLabel: /^general$/i },
            ],
          },
          matchesAnyField(titleFields),
        ],
      },
    ],
  };
}

export function buildCatalogSearchExclusions(search, fields) {
  const normalizedTerms = getCatalogSearchTermGroups(search)
    .flat()
    .map(asciiFold);
  const titleFields = [...new Set(fields.filter((field) => /(^|\.)title$/.test(field)))];
  const exclusions = [];

  for (const profile of SEARCH_PRODUCT_PROFILES) {
    if (!normalizedTerms.some((term) => profile.terms.includes(term))) continue;

    const pattern = profile.negativePattern || new RegExp(
      `(^|[^\\p{L}\\p{N}])(?:${profile.accessoryTerms.map(escapeRegex).join("|")})([^\\p{L}\\p{N}]|$)`,
      "iu",
    );
    exclusions.push(...titleFields.map((field) => ({ [field]: pattern })));
  }

  return exclusions;
}

export function getCatalogSearchRecommendationCategories(search) {
  const normalizedTerms = getCatalogSearchTermGroups(search)
    .flat()
    .map(asciiFold);
  const profile = SEARCH_PRODUCT_PROFILES.find(({ terms }) =>
    normalizedTerms.some((term) => terms.includes(term)),
  );

  return profile?.categoryKeys || [];
}
