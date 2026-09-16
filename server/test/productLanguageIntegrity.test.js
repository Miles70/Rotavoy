import assert from "node:assert/strict";
import test from "node:test";
import { getProductTranslationIntegrityIssues } from "../src/services/productTranslation.js";

function entry(title, description, categoryLabel, variant = "Default") {
  return {
    title,
    description,
    categoryLabel,
    variant,
    features: [description],
  };
}

function validTranslations() {
  return {
    en: entry("Portable Blender", "A compact blender with USB charging and four steel blades for daily use.", "Home > Kitchen"),
    tr: entry("Taşınabilir Blender", "USB ile şarj edilen bu kompakt blender, günlük kullanım için dört çelik bıçak sunar.", "Ev > Mutfak"),
    ru: entry("Портативный блендер", "Компактный блендер с USB-зарядкой и четырьмя стальными лезвиями для ежедневного использования.", "Дом > Кухня"),
    ar: entry("خلاط محمول", "خلاط مدمج مع شحن USB وأربع شفرات فولاذية للاستخدام اليومي.", "المنزل > المطبخ"),
    zh: entry("便携式搅拌机", "紧凑型搅拌机支持 USB 充电，并配有四片钢制刀片，适合日常使用。", "家居 > 厨房"),
    es: entry("Batidora portátil", "Batidora compacta con carga USB y cuatro cuchillas de acero para el uso diario.", "Hogar > Cocina"),
    pt: entry("Liquidificador portátil", "Liquidificador compacto com carregamento USB e quatro lâminas de aço para o uso diário.", "Casa > Cozinha"),
    fr: entry("Blender portable", "Blender compact avec recharge USB et quatre lames en acier pour un usage quotidien.", "Maison > Cuisine"),
    de: entry("Tragbarer Mixer", "Kompakter Mixer mit USB-Ladefunktion und vier Stahlklingen für die tägliche Nutzung.", "Haus > Küche"),
    it: entry("Frullatore portatile", "Frullatore compatto con ricarica USB e quattro lame in acciaio per l'uso quotidiano.", "Casa > Cucina"),
  };
}

test("accepts a complete ten-language localized bundle", () => {
  assert.deepEqual(getProductTranslationIntegrityIssues(validTranslations()), []);
});

test("flags Turkish copy that duplicates English", () => {
  const translations = validTranslations();
  translations.tr = { ...translations.en };
  assert.ok(getProductTranslationIntegrityIssues(translations).includes("tr:duplicates-en"));
});

test("flags Russian copy without Cyrillic text", () => {
  const translations = validTranslations();
  translations.ru = entry("Portable Blender", "Compact blender with USB charging and steel blades for everyday use.", "Home > Kitchen");
  assert.ok(getProductTranslationIntegrityIssues(translations).includes("ru:wrong-script"));
});
