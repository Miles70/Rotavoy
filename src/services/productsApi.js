const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export function getProductVideoUrl(productKey) {
  return `${apiBaseUrl}/api/products/${encodeURIComponent(productKey)}/video`;
}

const supportedProductLanguages = [
  "en",
  "tr",
  "ru",
  "ar",
  "zh",
  "es",
  "pt",
  "fr",
  "de",
  "it",
];

const numberLocales = {
  en: "en-US",
  tr: "tr-TR",
  ru: "ru-RU",
  ar: "ar-SA",
  zh: "zh-CN",
  es: "es-ES",
  pt: "pt-BR",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
};

const detailLabels = {
  en: {
    supplier: "Supplier",
    variant: "Variant",
    sku: "SKU",
    originCountry: "Country of origin",
    weightGrams: "Weight",
  },
  tr: {
    supplier: "Tedarikçi",
    variant: "Varyant",
    sku: "SKU",
    originCountry: "Menşei",
    weightGrams: "Ağırlık",
  },
  ru: {
    supplier: "Поставщик",
    variant: "Вариант",
    sku: "Артикул",
    originCountry: "Страна происхождения",
    weightGrams: "Вес",
  },
  ar: {
    supplier: "المورّد",
    variant: "الخيار",
    sku: "SKU",
    originCountry: "بلد المنشأ",
    weightGrams: "الوزن",
  },
  zh: {
    supplier: "供应商",
    variant: "规格",
    sku: "SKU",
    originCountry: "原产国",
    weightGrams: "重量",
  },
  es: {
    supplier: "Proveedor",
    variant: "Variante",
    sku: "SKU",
    originCountry: "País de origen",
    weightGrams: "Peso",
  },
  pt: {
    supplier: "Fornecedor",
    variant: "Variante",
    sku: "SKU",
    originCountry: "País de origem",
    weightGrams: "Peso",
  },
  fr: {
    supplier: "Fournisseur",
    variant: "Variante",
    sku: "SKU",
    originCountry: "Pays d'origine",
    weightGrams: "Poids",
  },
  de: {
    supplier: "Lieferant",
    variant: "Variante",
    sku: "SKU",
    originCountry: "Herkunftsland",
    weightGrams: "Gewicht",
  },
  it: {
    supplier: "Fornitore",
    variant: "Variante",
    sku: "SKU",
    originCountry: "Paese di origine",
    weightGrams: "Peso",
  },
};

function normalizeLanguage(value) {
  const language = String(value || "en").toLowerCase();
  return supportedProductLanguages.includes(language) ? language : "en";
}

function getProductTranslation(product, language) {
  const translations = product?.translations;
  if (!translations || typeof translations !== "object") return null;

  const localized = translations[language];
  if (localized && typeof localized === "object") return localized;

  const english = translations.en;
  return english && typeof english === "object" ? english : null;
}

const portableBlenderCopy = {
  en: {
    title: "USB Rechargeable Portable Mini Blender",
    common: "Compact smoothie blender with USB charging and four SUS304 stainless-steel blades.",
    option: "This is the {variant} option.",
    capacity: "This option is the {capacity} model.",
    pair: "This package contains two blenders: {variant}.",
    simple: "This {variant} option is supplied in simple packaging.",
    set: "This is the {variant} package; its contents are shown in the product images.",
  },
  tr: {
    title: "USB Şarjlı Taşınabilir Mini Blender",
    common: "USB ile şarj edilen, dört adet SUS304 paslanmaz çelik bıçaklı kompakt smoothie blenderı.",
    option: "Bu seçenek {variant} modelidir.",
    capacity: "Bu seçenek {capacity} hacimli modeldir.",
    pair: "Bu paket iki blender içerir: {variant}.",
    simple: "Bu {variant} seçenek sade ambalajla gönderilir.",
    set: "Bu seçenek {variant} paketidir; paket içeriği ürün görsellerinde gösterilir.",
  },
  ru: { title: "Портативный мини-блендер с USB-зарядкой", common: "Компактный блендер для смузи с USB-зарядкой и четырьмя лезвиями из нержавеющей стали SUS304.", option: "Это вариант {variant}.", capacity: "Это модель объёмом {capacity}.", pair: "В комплект входят два блендера: {variant}.", simple: "Вариант {variant} поставляется в простой упаковке.", set: "Это комплект {variant}; содержимое показано на фотографиях товара." },
  ar: { title: "خلاط صغير محمول قابل للشحن عبر USB", common: "خلاط سموذي صغير يُشحن عبر USB ومزوّد بأربع شفرات من الفولاذ المقاوم للصدأ SUS304.", option: "هذا هو خيار {variant}.", capacity: "هذا هو الطراز بسعة {capacity}.", pair: "تحتوي هذه العبوة على خلاطين: {variant}.", simple: "يأتي خيار {variant} في عبوة بسيطة.", set: "هذه حزمة {variant}؛ محتوياتها موضحة في صور المنتج." },
  zh: { title: "USB充电便携式迷你榨汁机", common: "紧凑型便携式果昔机，支持USB充电，配备四片SUS304不锈钢刀片。", option: "当前选择为{variant}。", capacity: "当前选择为{capacity}容量款。", pair: "此包装包含两台榨汁机：{variant}。", simple: "{variant}选项采用简易包装。", set: "当前选择为{variant}套装，具体内容见商品图片。" },
  es: { title: "Mini batidora portátil recargable por USB", common: "Batidora compacta para smoothies con carga USB y cuatro cuchillas de acero inoxidable SUS304.", option: "Esta es la opción {variant}.", capacity: "Esta opción tiene una capacidad de {capacity}.", pair: "Este paquete contiene dos batidoras: {variant}.", simple: "La opción {variant} se entrega en embalaje sencillo.", set: "Este es el paquete {variant}; su contenido aparece en las imágenes." },
  pt: { title: "Mini liquidificador portátil recarregável por USB", common: "Liquidificador compacto para smoothies com carregamento USB e quatro lâminas de aço inoxidável SUS304.", option: "Esta é a opção {variant}.", capacity: "Esta opção tem capacidade de {capacity}.", pair: "Este pacote contém dois liquidificadores: {variant}.", simple: "A opção {variant} é enviada em embalagem simples.", set: "Este é o pacote {variant}; o conteúdo aparece nas imagens." },
  fr: { title: "Mini blender portable rechargeable par USB", common: "Blender compact pour smoothies, rechargeable par USB et doté de quatre lames en acier inoxydable SUS304.", option: "Il s’agit de l’option {variant}.", capacity: "Cette option offre une capacité de {capacity}.", pair: "Ce lot contient deux blenders : {variant}.", simple: "L’option {variant} est livrée dans un emballage simple.", set: "Il s’agit du lot {variant} ; son contenu est présenté sur les images." },
  de: { title: "Tragbarer USB-Mini-Mixer", common: "Kompakter Smoothie-Mixer mit USB-Ladefunktion und vier SUS304-Edelstahlklingen.", option: "Dies ist die Variante {variant}.", capacity: "Diese Variante hat ein Fassungsvermögen von {capacity}.", pair: "Dieses Paket enthält zwei Mixer: {variant}.", simple: "Die Variante {variant} wird in einfacher Verpackung geliefert.", set: "Dies ist das Paket {variant}; der Inhalt ist auf den Produktbildern zu sehen." },
  it: { title: "Mini frullatore portatile ricaricabile USB", common: "Frullatore compatto per smoothie con ricarica USB e quattro lame in acciaio inox SUS304.", option: "Questa è l’opzione {variant}.", capacity: "Questa opzione ha una capacità di {capacity}.", pair: "La confezione contiene due frullatori: {variant}.", simple: "L’opzione {variant} viene fornita in confezione semplice.", set: "Questo è il pacchetto {variant}; il contenuto è mostrato nelle immagini." },
};

function isCuratedPortableBlender(product) {
  const englishTitle = String(
    product?.translations?.en?.title || product?.title || "",
  ).toLowerCase();
  return (
    englishTitle.includes("electric juicer blender mixer") ||
    englishTitle.includes("portable blender maker cup kitchen tool kit")
  );
}

function buildPortableBlenderCopy(product, language, variantLabel) {
  if (!isCuratedPortableBlender(product)) return null;

  const copy = portableBlenderCopy[language] || portableBlenderCopy.en;
  const fallback = portableBlenderCopy.en;
  const variant = String(variantLabel || "").trim();
  const normalized = variant.toLowerCase();
  const capacity = variant.match(/\b(?:350|380|420)\s*ml\b/i)?.[0] || "";
  const isPair = /\b(?:2\s*(?:pcs?|adet)|white\s*[-+&/]?\s*pink|beyaz\s*[-+&/]?\s*pembe)\b/i.test(variant);
  const isSimple = /simple packaging|basic packaging|basit ambalaj|sade ambalaj/i.test(variant);
  const isSet = /\bset\s*\d*\b/i.test(variant);
  let detailTemplate = copy.option || fallback.option;

  if (isPair) detailTemplate = copy.pair || fallback.pair;
  else if (isSimple) detailTemplate = copy.simple || fallback.simple;
  else if (isSet) detailTemplate = copy.set || fallback.set;
  else if (capacity) detailTemplate = copy.capacity || fallback.capacity;

  const detail = detailTemplate
    .replace("{variant}", variant)
    .replace("{capacity}", capacity);
  const common = copy.common || fallback.common;
  const baseTitle = copy.title || fallback.title;

  return {
    title: variant && normalized !== "default" ? `${baseTitle} – ${variant}` : baseTitle,
    description: `${common} ${detail}`,
  };
}

function humanizeDetailKey(value) {
  return String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function localizeCountryCode(countryCode, language) {
  const code = String(countryCode || "").trim().toUpperCase();
  if (!code) return "";

  try {
    if (typeof Intl?.DisplayNames !== "function") return code;
    const displayNames = new Intl.DisplayNames([numberLocales[language] || "en-US"], {
      type: "region",
    });
    return displayNames.of(code) || code;
  } catch {
    return code;
  }
}

function localizeDetails(product, language, translation) {
  const details = product?.details;
  if (!details || typeof details !== "object" || Array.isArray(details)) return details || {};

  const labels = detailLabels[language] || detailLabels.en;
  const locale = numberLocales[language] || numberLocales.en;
  const localized = {};

  for (const [key, rawValue] of Object.entries(details)) {
    if (rawValue === "" || rawValue === null || rawValue === undefined) continue;

    const label = labels[key] || humanizeDetailKey(key);
    let value = rawValue;

    if (key === "supplier") {
      value = "Rotavoy";
    } else if (key === "variant" && translation?.variant) {
      value = translation.variant;
    } else if (key === "originCountry") {
      value = localizeCountryCode(rawValue, language);
    } else if (key === "weightGrams") {
      const grams = Number(rawValue || 0);
      value = `${Number.isFinite(grams) ? grams.toLocaleString(locale) : rawValue} g`;
    }

    localized[label] = value;
  }

  return localized;
}

export function normalizeProduct(product, requestedLanguage = "en") {
  if (!product) return product;

  const language = normalizeLanguage(requestedLanguage);
  const translation = getProductTranslation(product, language);
  const localizedFeatures = Array.isArray(translation?.features)
    ? translation.features.filter(Boolean)
    : product.features;
  const variantLabel = String(translation?.variant || product?.details?.variant || "").trim();
  const localizedTitle = translation?.title || product.title || "";
  const curatedCopy = buildPortableBlenderCopy(product, language, variantLabel);
  // Logical CJ groups can represent different capacities, bundle sizes or
  // packaging under one supplier parent. Keep the representative variant in
  // the title so separate storefront cards never look like duplicates.
  const usefulVariant = variantLabel && variantLabel.toLowerCase() !== "default";
  const title = curatedCopy?.title || (usefulVariant && !localizedTitle.toLocaleLowerCase().includes(
    variantLabel.toLocaleLowerCase(),
  )
    ? `${localizedTitle} - ${variantLabel}`
    : localizedTitle);

  return {
    ...product,
    title,
    variantLabel,
    description: curatedCopy?.description || translation?.description || product.description || "",
    categoryLabel: translation?.categoryLabel || product.categoryLabel || "",
    features: Array.isArray(localizedFeatures) ? localizedFeatures : [],
    details: localizeDetails(product, language, translation),
    imageUrl: product.imageUrl || product.images?.[0] || "",
  };
}

async function storeRequest(path) {
  const response = await fetch(`${apiBaseUrl}/api${path}`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Product request failed.");
  }

  return data;
}

export async function getStoreProducts({
  page = 1,
  limit = 24,
  search = "",
  category = "",
  group = "",
  sort = "popular",
  language = "en",
} = {}) {
  const normalizedLanguage = normalizeLanguage(language);
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sort,
    language: normalizedLanguage,
  });

  if (search) query.set("search", search);
  if (category) query.set("category", category);
  if (group) query.set("group", group);

  const data = await storeRequest(`/products?${query.toString()}`);

  return {
    ...data,
    products: (data.products || []).map((product) => normalizeProduct(product, normalizedLanguage)),
  };
}

export async function getStoreProduct(productKey, language = "en") {
  const normalizedLanguage = normalizeLanguage(language);
  const query = new URLSearchParams({ language: normalizedLanguage });
  const data = await storeRequest(`/products/${encodeURIComponent(productKey)}?${query.toString()}`);

  return {
    ...data,
    product: normalizeProduct(data.product, normalizedLanguage),
    variants: (data.variants || []).map((variant) => normalizeProduct(variant, normalizedLanguage)),
  };
}

export async function getRelatedStoreProducts(productKey, language = "en", limit = 8) {
  const normalizedLanguage = normalizeLanguage(language);
  const query = new URLSearchParams({
    language: normalizedLanguage,
    limit: String(limit),
  });
  const data = await storeRequest(
    `/products/${encodeURIComponent(productKey)}/related?${query.toString()}`,
  );

  return (data.products || []).map((product) => normalizeProduct(product, normalizedLanguage));
}
