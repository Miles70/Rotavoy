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
      /\bskincare\b/i, /\bnail care\b/i, /\bnail art\b/i, /\bnail polish\b/i,
      /\bmanicure\b/i, /\bpedicure\b/i,
      /\beyelash/i, /\beyebrow/i, /\bface care\b/i, /\bhair care\b/i,
      /\bperfume\b/i, /\bfragrance\b/i, /\bpersonal care\b/i,
      /\bhair dryer\b/i, /\bhair styling\b/i, /\bhair straightener\b/i,
      /\bhair curler\b/i, /\bflat iron\b/i, /\bshaver\b/i,
      /\brazor\b/i, /\bepilator\b/i,
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
      /\bearbuds?\b/i, /\bbluetooth\b/i, /\bsmart ?watch(?:es)?\b/i,
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
      /\bluggage\b/i, /\bsuitcase\b/i,
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
      /\bnotebook\b/i, /\bnotepad\b/i, /\bballpoint pen\b/i,
      /\bfountain pen\b/i, /\bdesk mat\b/i, /\bfile folder\b/i,
    ],
  },
  {
    key: "appliances",
    patterns: [
      /\bappliance(?:s)?\b/i, /\bvacuum cleaner\b/i, /\bblender\b/i,
      /\bair fryer\b/i, /\bcoffee maker\b/i, /\bhumidifier\b/i,
      /\bair purifier\b/i, /\bheater\b/i, /\brefrigerator\b/i,
      /\bwashing machine\b/i, /\bmicrowave\b/i, /\bair conditioner\b/i,
      /\bfoot warmer\b/i, /\bshoe dryer\b/i, /\bcup warmer\b/i,
      /\bair cooler\b/i,
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
      /\bblanket\b/i, /\bchristmas tree\b/i, /\bincense burner\b/i,
      /\bsofa cushion\b/i, /\bbedside table\b/i,
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

function matchingCategoryKeys(text) {
  return CATEGORY_RULES
    .filter((rule) => matchRule(text, rule))
    .map((rule) => rule.key);
}

function hasStrongPetTitleSignal(title) {
  const value = cleanCategoryText(title).toLowerCase();
  if (!value) return false;
  if (/\bpet(?:s)?\b|\bpet supplies?\b/.test(value)) return true;
  if (/\bfor\s+(?:a\s+)?(?:dog|cat)s?\b/.test(value)) return true;
  if (/\bdog\s+(?:toy|toys|leash|collar|harness|brush|bowl|bed|seat|carrier|traction|poop|sweater|shoe|shoes|vest)\b/.test(value)) return true;
  if (/\bcat\s+(?:toy|toys|litter|bed|carrier|brush|scratcher|tree)\b/.test(value)) return true;
  return false;
}

function hasStrongToyTitleSignal(title) {
  const value = cleanCategoryText(title).toLowerCase();
  if (!value) return false;
  if (/\btoy(?:s)?\b/.test(value)) return true;
  if (
    /\bdisplay (?:stand|case)\b|\bstorage (?:box|case)\b|\bpackaging box\b|\bchristmas decor\b|\bhome decor\b|\bwall decor\b/.test(value)
  ) {
    return false;
  }
  return /\bdoll(?:s)?\b|\bplush\b|\bpuzzle\b|\baction figure\b|\bpretend play\b/.test(value);
}

function hasStrongBabyTitleSignal(title) {
  const value = cleanCategoryText(title);
  if (/\binfant\b|\bnewborn\b|\btoddler\b/i.test(value)) return true;
  return /\bbaby(?:\s+[a-z0-9'-]+){0,2}\s+(?:bottle|chair|seat|bidet|headband|monitor|romper|clothing|shoe|shoes|stroller|carrier|toy|toys)\b/i.test(value);
}

function hasStrongAutomotiveTitleSignal(title) {
  const value = cleanCategoryText(title);
  return /\bcar\b|\bvehicle\b|\bautomotive\b|\bmotorcycle\b|\btire\b|\btyre\b|\bdash(?:cam|board)\b|\bheadlight\b|\btpms\b|\bdriving recorder\b/i.test(
    value,
  );
}

function classifySupplierTaxonomy(categoryLabel, title = "") {
  const label = cleanCategoryText(categoryLabel).toLowerCase();
  const productTitle = cleanCategoryText(title);
  const titleLower = productTitle.toLowerCase();
  const titleMatches = matchingCategoryKeys(productTitle);
  if (!label) return "";

  // Prefer CJ's top-level taxonomy over incidental words in a product title.
  // A few known broad/misfiled supplier branches are resolved with title
  // evidence below instead of blindly trusting a single keyword.
  if (/\bpet supplies\b/.test(label)) {
    if (
      /\braised garden bed\b|\bplanter box\b|\bgreenhouse\b/.test(titleLower) &&
      !/\bpet\b|\bdog\b|\bcat\b|\banimal\b/.test(titleLower)
    ) {
      return "tools";
    }
    return "pets";
  }

  if (/\bautomobiles?\b.*\bmotorcycles?\b|\bautomotive\b/.test(label)) return "automotive";
  if (/\bsports?\b.*\boutdoors?\b/.test(label)) return "sports";
  if (/\bconsumer electronics\b|\bphones?\b.*\baccessories\b/.test(label)) return "electronics";

  if (/\bcomputer\b.*\boffice\b/.test(label)) {
    if (/\boffice electronics\b|\boffice\s*&\s*school supplies\b|\bstationery\b|\bhome office storage\b/.test(label)) {
      return "office";
    }
    return "electronics";
  }

  if (/\btoys?\b.*\bkids?\b.*\bbab(?:y|ies)\b/.test(label)) {
    if (
      /\belectronic pets\b/.test(label) &&
      /\banti[- ]?lost\b|\bbluetooth tracker\b|\bgps locator\b|\btracking locator\b/.test(titleLower) &&
      !/\btoy\b|\bdoll\b|\bsimulation\b|\bpretend\b/.test(titleLower)
    ) {
      return "electronics";
    }

    if (/\bdoll\b/.test(titleLower)) return "toys";

    if (
      /\bbaby\s*&\s*mother\b|\bbaby clothing\b|\bboys? clothing\b|\bgirls? clothing\b|\bshoes?\s*&\s*bags\b|\bbaby accessories\b|\bfirst walkers\b/.test(label)
    ) {
      return "baby";
    }

    if (/\btoys?\s*&\s*hobbies\b|\bstuffed\s*&\s*plush\b|\baction\s*&\s*toy figures\b|\beducational toys\b/.test(label)) {
      return "toys";
    }

    return "toys";
  }

  if (/\bhealth\b.*\bbeauty\b.*\bhair\b/.test(label)) {
    if (
      /\bfood\s*&\s*beverage\b/.test(label) ||
      (
        /\bfood\s*&\s*health\b/.test(label) &&
        /\bcoffee\b|\btea\b|\bbeverage\b|\bsnack\b|\bcandy\b|\bchocolate\b/.test(titleLower)
      )
    ) {
      return "grocery";
    }
    return "beauty";
  }

  if (/\bhome improvement\b/.test(label)) {
    // Only strong product-type evidence may override a Home Improvement branch.
    // Animal words used as decoration ("cat lamp", "rabbit night light") must
    // not turn ordinary lighting into pet supplies.
    if (hasStrongPetTitleSignal(productTitle)) return "pets";
    if (hasStrongBabyTitleSignal(productTitle)) return "baby";
    if (hasStrongToyTitleSignal(productTitle)) return "toys";
    if (hasStrongAutomotiveTitleSignal(productTitle)) return "automotive";

    if (/\bpersonal care appliances\b/.test(label)) return "beauty";
    if (/\bhome appliances\b|\bkitchen appliances\b|\bair conditioning appliances\b|\bhome appliance parts\b/.test(label)) {
      return "appliances";
    }
    if (/\bpower tools?\b|\bhand tools?\b|\bgarden tools?\b|\bhardware\b/.test(label)) return "tools";
    return "home";
  }

  if (/\bhome\b.*\bgarden\b|\bhome\b.*\bfurniture\b/.test(label)) {
    if (/\bhome appliances\b|\bkitchen appliances\b/.test(label)) return "appliances";
    if (/\bgarden tools?\b|\bpower tools?\b|\bhand tools?\b|\bhardware\b/.test(label)) return "tools";
    if (/\b(?:garden|power|hand) tools?\b|\bpower tool set\b/.test(titleLower)) return "tools";

    if (/\bhome office storage\b/.test(label)) {
      // This CJ branch is extremely noisy. Finished storage/display goods stay
      // in Home even when their titles contain fashion/toy words such as
      // "jewelry" or "doll".
      if (
        /\bjewelry box\b|\bdisplay (?:stand|case)\b|\bstorage (?:box|case)\b|\bpackaging box\b|\bchristmas decor\b|\bhome decor\b/.test(titleLower)
      ) {
        return "home";
      }

      // First rescue only strong, explicit product types; then use the broader
      // title classifier.
      if (hasStrongPetTitleSignal(productTitle)) return "pets";
      if (hasStrongBabyTitleSignal(productTitle)) return "baby";
      if (hasStrongToyTitleSignal(productTitle)) return "toys";
      if (hasStrongAutomotiveTitleSignal(productTitle)) return "automotive";

      for (const preferred of [
        "beauty",
        "appliances",
        "electronics",
        "sports",
        "home",
        "office",
        "tools",
        "fashion",
      ]) {
        if (titleMatches.includes(preferred)) return preferred;
      }
      return "home";
    }

    if (/\barts?\b.*\bcrafts?\b|\bcrafts?\b.*\bsewing\b/.test(label)) {
      if (/\bwall decoration\b|\bwall decor\b|\bdecor painting\b|\bhanging painting\b/.test(titleLower)) {
        return "home";
      }
      for (const preferred of ["office", "home", "hobby", "fashion", "tools", "electronics"]) {
        if (titleMatches.includes(preferred)) return preferred;
      }
      return "hobby";
    }

    return "home";
  }

  if (/\bjewelry\b.*\bwatches\b/.test(label)) return "fashion";
  if (/\bfood\b.*\bbeverage\b|\bgrocery\b|\bsupermarket\b/.test(label)) return "grocery";

  return "";
}

export function classifyCatalogCategory({ categoryLabel = "", title = "" } = {}) {
  const taxonomyCategory = classifySupplierTaxonomy(categoryLabel, title);
  if (taxonomyCategory) return taxonomyCategory;

  const label = cleanCategoryText(categoryLabel);
  const productTitle = cleanCategoryText(title);
  const labelMatches = matchingCategoryKeys(label);
  const titleMatches = matchingCategoryKeys(productTitle);

  if (labelMatches.length === 1) return labelMatches[0];

  if (labelMatches.length > 1) {
    const titleSupported = labelMatches.find((key) => titleMatches.includes(key));
    if (titleSupported) return titleSupported;
    return labelMatches[0];
  }

  if (titleMatches.length) return titleMatches[0];

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
