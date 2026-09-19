const CATEGORY_RULES = [
  {
    key: "baby",
    patterns: [
      /\bbaby\b/i, /\binfant\b/i, /\bnewborn\b/i, /\btoddler\b/i,
      /\bmaternity\b/i, /\bnursing\b/i, /\bbreastfeed/i, /\bdiaper/i,
      /\bpram\b/i, /\bstroller\b/i, /\bpacifier\b/i, /\bchild care\b/i,
    ],
  },
  {
    key: "pets",
    patterns: [
      /\bpet(?:s)?\b/i, /\bdog(?:s)?\b/i, /\bcat(?:s)?\b/i,
      /\baquarium\b/i, /\bhamster\b/i, /\brabbit\b/i, /\bbird cage\b/i,
      /\bleash\b/i, /\bpet collar\b/i, /\bcat litter\b/i,
    ],
  },
  {
    key: "automotive",
    patterns: [
      /\bautomotive\b/i, /\bvehicle\b/i, /\bmotorcycle\b/i, /\bmotorbike\b/i,
      /\bcar\b/i, /\bauto parts?\b/i, /\bwindshield\b/i, /\bdashboard\b/i,
      /\bobd\b/i, /\btire\b/i, /\btyre\b/i, /\bcar charger\b/i,
    ],
  },
  {
    key: "toys",
    patterns: [
      /\btoy(?:s)?\b/i, /\bdoll(?:s)?\b/i, /\bplush\b/i,
      /\bpuzzle(?:s)?\b/i, /\bbuilding blocks?\b/i, /\baction figure\b/i,
      /\bpretend play\b/i,
    ],
  },
  {
    key: "beauty",
    patterns: [
      /\bbeauty\b/i, /\bmakeup\b/i, /\bcosmetic(?:s)?\b/i, /\bskin care\b/i,
      /\bskincare\b/i, /\bnail(?:s)?\b/i, /\bmanicure\b/i, /\bpedicure\b/i,
      /\beyelash/i, /\beyebrow/i, /\bface care\b/i, /\bhair care\b/i,
      /\bperfume\b/i, /\bfragrance\b/i,
    ],
  },
  {
    key: "sports",
    patterns: [
      /\bsport(?:s)?\b/i, /\boutdoor\b/i, /\bcamping\b/i, /\bfitness\b/i,
      /\bgym\b/i, /\byoga\b/i, /\bhiking\b/i, /\bcycling\b/i,
      /\bbicycle\b/i, /\bfishing\b/i, /\bswimming\b/i, /\brunning\b/i,
      /\bfootball\b/i, /\bbasketball\b/i,
    ],
  },
  {
    key: "electronics",
    patterns: [
      /\belectronic(?:s)?\b/i, /\bsmart ?phone\b/i, /\bmobile phone\b/i,
      /\bphone\b/i, /\btablet\b/i, /\bcomputer\b/i, /\blaptop\b/i,
      /\bcamera\b/i, /\baudio\b/i, /\bheadphone/i, /\bearphone/i,
      /\bearbuds?\b/i, /\bbluetooth\b/i, /\bsmart ?watch\b/i,
      /\bpower bank\b/i, /\bcharger\b/i, /\busb\b/i, /\bkeyboard\b/i,
      /\bprojector\b/i, /\bspeaker\b/i, /\bdrone\b/i,
    ],
  },
  {
    key: "fashion",
    patterns: [
      /\bfashion\b/i, /\bclothing\b/i, /\bapparel\b/i, /\bgarment\b/i,
      /\bshoe(?:s)?\b/i, /\bsneaker(?:s)?\b/i, /\bsandal(?:s)?\b/i,
      /\bhandbag\b/i, /\bbackpack\b/i, /\bbag(?:s)?\b/i, /\bjewel(?:ry|lery)\b/i,
      /\bnecklace\b/i, /\bbracelet\b/i, /\bring\b/i, /\bwatch(?:es)?\b/i,
      /\bdress\b/i, /\bshirt\b/i, /\btrouser/i, /\bpants?\b/i,
      /\bunderwear\b/i, /\bbra\b/i, /\bsocks?\b/i, /\bhat\b/i, /\bcap\b/i,
    ],
  },
  {
    key: "tools",
    patterns: [
      /\btool(?:s)?\b/i, /\bhardware\b/i, /\bgarden(?:ing)?\b/i,
      /\bdrill\b/i, /\bwrench\b/i, /\bscrewdriver\b/i, /\bwelding\b/i,
      /\bpower tool\b/i, /\blawn\b/i,
    ],
  },
  {
    key: "gaming",
    patterns: [
      /\bgaming\b/i, /\bvideo game\b/i, /\bgame console\b/i,
      /\bconsole controller\b/i,
    ],
  },
  {
    key: "hobby",
    patterns: [
      /\bhobby\b/i, /\bcraft(?:s)?\b/i, /\bcollectible(?:s)?\b/i,
      /\bmodel kit\b/i, /\bart supplies\b/i, /\bpainting\b/i,
      /\bmusical instrument\b/i, /\bguitar\b/i, /\bukulele\b/i,
      /\bbook(?:s)?\b/i, /\bmusic\b/i, /\bmovie(?:s)?\b/i, /\bfilm\b/i,
    ],
  },
  {
    key: "office",
    patterns: [
      /\boffice\b/i, /\bstationery\b/i, /\boffice supplies\b/i,
      /\bstapler\b/i, /\bprinter paper\b/i, /\bdesk organizer\b/i,
    ],
  },
  {
    key: "appliances",
    patterns: [
      /\bappliance(?:s)?\b/i, /\bvacuum cleaner\b/i, /\bblender\b/i,
      /\bair fryer\b/i, /\bcoffee maker\b/i, /\bhumidifier\b/i,
      /\bair purifier\b/i, /\bheater\b/i, /\brefrigerator\b/i,
      /\bwashing machine\b/i, /\bmicrowave\b/i,
    ],
  },
  {
    key: "grocery",
    patterns: [
      /\bgrocery\b/i, /\bsupermarket\b/i, /\bfood\b/i, /\bsnack(?:s)?\b/i,
      /\bbeverage(?:s)?\b/i, /\bcoffee\b/i, /\btea\b/i, /\bcandy\b/i,
      /\bchocolate\b/i, /\bspice(?:s)?\b/i, /\bseasoning\b/i,
    ],
  },
  {
    key: "home",
    patterns: [
      /\bhome\b/i, /\bhousehold\b/i, /\bkitchen\b/i, /\bfurniture\b/i,
      /\bdecor(?:ation)?\b/i, /\bbedding\b/i, /\bbathroom\b/i,
      /\bstorage\b/i, /\borganizer\b/i, /\blamp\b/i, /\blighting\b/i,
      /\bcookware\b/i, /\btableware\b/i, /\bcurtain\b/i, /\bpillow\b/i,
      /\bblanket\b/i,
    ],
  },
];

function cleanCategoryText(value) {
  return String(value || "")
    .replace(/[_/|>]+/g, " ")
    .replace(/[-–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchRule(text, rule) {
  return rule.patterns.some((pattern) => pattern.test(text));
}

export function classifyCatalogCategory({ categoryLabel = "", title = "" } = {}) {
  const label = cleanCategoryText(categoryLabel);
  const productTitle = cleanCategoryText(title);

  // Supplier taxonomy is the strongest signal. Priority resolves mixed labels
  // such as "baby clothing", "car charger", "pet bag" and "smart watch".
  for (const rule of CATEGORY_RULES) {
    if (matchRule(label, rule)) return rule.key;
  }

  // Fall back to the parent product title only when the supplier category is
  // too generic or missing.
  for (const rule of CATEGORY_RULES) {
    if (matchRule(productTitle, rule)) return rule.key;
  }

  // Keep uncategorised household/general merchandise visible rather than
  // dropping it from the storefront.
  return "home";
}

export const CATALOG_CATEGORY_KEYS = Object.freeze([
  "electronics",
  "fashion",
  "home",
  "office",
  "appliances",
  "automotive",
  "tools",
  "baby",
  "toys",
  "sports",
  "beauty",
  "pets",
  "grocery",
  "gaming",
  "hobby",
]);
