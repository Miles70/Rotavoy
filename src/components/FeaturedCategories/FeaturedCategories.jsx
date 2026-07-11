import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Briefcase,
  Car,
  Dumbbell,
  Gamepad2,
  Heart,
  House,
  Package,
  PawPrint,
  Plug,
  Puzzle,
  Shirt,
  Smartphone,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext";
import { getProductCategories } from "../../services/productsApi";
import "./FeaturedCategories.css";

const descriptions = {
  en: {
    electronics: "Devices, accessories and everyday technology.",
    mobile: "Phones, cases, chargers and mobile essentials.",
    home: "Useful products for every room in your home.",
    fashion: "Clothing, shoes, jewelry and accessories.",
    fallback: "Selected products from the shopping catalog.",
  },
  tr: {
    electronics: "Cihazlar, aksesuarlar ve günlük teknoloji ürünleri.",
    mobile: "Telefonlar, kılıflar, şarj cihazları ve aksesuarlar.",
    home: "Evin her alanı için kullanışlı ürünler.",
    fashion: "Giyim, ayakkabı, takı ve aksesuarlar.",
    fallback: "Alışveriş kataloğundan seçilmiş ürünler.",
  },
  ru: {
    electronics: "Устройства, аксессуары и техника.",
    mobile: "Телефоны, чехлы, зарядные устройства и аксессуары.",
    home: "Полезные товары для каждой комнаты.",
    fashion: "Одежда, обувь, украшения и аксессуары.",
    fallback: "Подборка товаров из каталога.",
  },
  ar: {
    electronics: "أجهزة وإكسسوارات وتقنيات للاستخدام اليومي.",
    mobile: "هواتف وأغطية وشواحن وإكسسوارات.",
    home: "منتجات مفيدة لكل غرفة في المنزل.",
    fashion: "ملابس وأحذية ومجوهرات وإكسسوارات.",
    fallback: "منتجات مختارة من كتالوج التسوق.",
  },
  zh: {
    electronics: "设备、配件和日常科技产品。",
    mobile: "手机、保护壳、充电器和配件。",
    home: "适合家中各个空间的实用商品。",
    fashion: "服装、鞋履、珠宝和配饰。",
    fallback: "购物目录中的精选商品。",
  },
};

function CategoryIcon({ categoryKey }) {
  const icons = {
    electronics: Package,
    mobile: Smartphone,
    home: House,
    fashion: Shirt,
    beauty: Sparkles,
    sports: Dumbbell,
    toys: Puzzle,
    gaming: Gamepad2,
    office: Briefcase,
    tools: Wrench,
    appliances: Plug,
    pets: PawPrint,
    automotive: Car,
    baby: Heart,
  };
  const Icon = icons[categoryKey] || Package;
  return <Icon />;
}

function FeaturedCategories() {
  const { t, language } = useLanguage();
  const [categories, setCategories] = useState([]);
  const copy = descriptions[language] || descriptions.en;

  useEffect(() => {
    const controller = new AbortController();

    getProductCategories({ signal: controller.signal })
      .then((payload) => setCategories((payload.categories || []).slice(0, 4)))
      .catch((error) => {
        if (error.name !== "AbortError") console.error(error);
      });

    return () => controller.abort();
  }, []);

  return (
    <section className="featuredCategories">
      <div className="container">
        <p className="sectionTag">{t("featuredCategories.tag")}</p>
        <h2>{t("featuredCategories.title")}</h2>

        <div className="categoryGrid">
          {categories.map((category) => (
            <Link
              className="categoryCard"
              key={category.key}
              to={`/products?category=${category.key}`}
              aria-label={category.title || category.key}
            >
              <div className="categoryIcon">
                <CategoryIcon categoryKey={category.key} />
              </div>

              <h3>{category.title || category.key}</h3>
              <p>{copy[category.key] || copy.fallback}</p>

              <span className="categoryArrow" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M13 6L19 12L13 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default FeaturedCategories;
