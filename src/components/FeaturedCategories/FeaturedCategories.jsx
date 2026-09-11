import { useEffect, useState } from "react";
import {
  Baby,
  BookOpen,
  Cpu,
  Dumbbell,
  House,
  Shirt,
  ShoppingBasket,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Link } from "react-router-dom";
import categories from "../../data/categories";
import { getCategoryGroupText } from "../../i18n/categoryGroupText";
import { useLanguage } from "../../i18n/LanguageContext";
import { getStoreProducts } from "../../services/productsApi";
import "./FeaturedCategories.css";

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

const categoryIcons = {
  electronics: Cpu,
  fashion: Shirt,
  homeLivingOffice: House,
  autoGardenTools: Wrench,
  motherBabyToys: Baby,
  sportsOutdoor: Dumbbell,
  beautyCare: Sparkles,
  supermarketPets: ShoppingBasket,
  booksMusicFilmHobby: BookOpen,
};

function FeaturedCategories() {
  const { t, language } = useLanguage();
  const [categoryData, setCategoryData] = useState({});
  const numberLocale = numberLocales[language] || numberLocales.en;

  useEffect(() => {
    let isCancelled = false;

    Promise.allSettled(
      categories.map((category) =>
        getStoreProducts({
          page: 1,
          limit: 3,
          group: category.key,
          sort: "popular",
          language,
        }),
      ),
    ).then((results) => {
      if (isCancelled) return;

      const nextCategoryData = {};

      results.forEach((result, index) => {
        const category = categories[index];

        nextCategoryData[category.key] =
          result.status === "fulfilled"
            ? {
                products: (result.value.products || []).slice(0, 3),
                total: Number(result.value.pagination?.total || 0),
              }
            : { products: [], total: 0 };
      });

      setCategoryData(nextCategoryData);
    });

    return () => {
      isCancelled = true;
    };
  }, [language]);

  return (
    <section className="featuredCategories">
      <div className="container">
        <p className="sectionTag">{t("featuredCategories.tag")}</p>
        <h2>{t("featuredCategories.title")}</h2>

        <div className="featuredCategoryGrid">
          {categories.map((category) => {
            const CategoryIcon = categoryIcons[category.key] || Sparkles;
            const categoryTitle = getCategoryGroupText(language, category.key, "title");
            const groupData = categoryData[category.key] || { products: [], total: 0 };

            return (
              <Link
                className="featuredCategoryCard"
                data-category={category.key}
                key={category.key}
                to={`/products?group=${category.key}&page=1`}
                aria-label={categoryTitle}
              >
                <div className="featuredCategoryGlow" aria-hidden="true" />

                <div className="featuredCategoryContent">
                  <div className="featuredCategoryTopRow">
                    <div className="featuredCategoryIcon">
                      <CategoryIcon aria-hidden="true" />
                    </div>

                    <span className="featuredCategoryCount">
                      {groupData.total > 0
                        ? `${groupData.total.toLocaleString(numberLocale)} ${t("categoriesPage.items")}`
                        : "—"}
                    </span>
                  </div>

                  <h3>{categoryTitle}</h3>
                  <p>{getCategoryGroupText(language, category.key, "description")}</p>
                </div>

                <div className="featuredCategoryPreviewStack" aria-hidden="true">
                  {[0, 1, 2].map((index) => {
                    const product = groupData.products[index];
                    const imageUrl = product?.imageUrl || product?.images?.[0] || "";

                    return (
                      <div
                        className={`featuredCategoryPreviewCard featuredCategoryPreviewCard${index + 1}${
                          imageUrl ? "" : " is-placeholder"
                        }`}
                        key={product?.key || `${category.key}-${index}`}
                      >
                        {imageUrl ? (
                          <img src={imageUrl} alt="" loading="lazy" decoding="async" />
                        ) : (
                          <CategoryIcon aria-hidden="true" />
                        )}
                      </div>
                    );
                  })}
                </div>

                <span className="featuredCategoryArrow" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 12H19"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M13 6L19 12L13 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default FeaturedCategories;
