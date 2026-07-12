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
import { useLanguage } from "../../i18n/LanguageContext";
import { getCategoryGroupText } from "../../i18n/categoryGroups";
import categories from "../../data/categories";
import { getStoreProducts } from "../../services/productsApi";
import "./FeaturedCategories.css";

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
  const [categoryProducts, setCategoryProducts] = useState({});

  useEffect(() => {
    let isCancelled = false;

    Promise.allSettled(
      categories.map((category) =>
        getStoreProducts({
          page: 1,
          limit: 3,
          group: category.key,
          sort: "popular",
        }),
      ),
    ).then((results) => {
      if (isCancelled) return;

      const nextCategoryProducts = {};

      results.forEach((result, index) => {
        const category = categories[index];
        nextCategoryProducts[category.key] =
          result.status === "fulfilled" ? (result.value.products || []).slice(0, 3) : [];
      });

      setCategoryProducts(nextCategoryProducts);
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <section className="featuredCategories">
      <div className="container">
        <p className="sectionTag">{t("featuredCategories.tag")}</p>
        <h2>{t("featuredCategories.title")}</h2>

        <div className="categoryGrid">
          {categories.map((category) => {
            const CategoryIcon = categoryIcons[category.key] || Sparkles;
            const categoryTitle = getCategoryGroupText(language, category.key, "title");
            const previewProducts = categoryProducts[category.key] || [];

            return (
              <Link
                className="categoryCard"
                data-category={category.key}
                key={category.key}
                to={`/products?group=${category.key}&page=1`}
                aria-label={categoryTitle}
              >
                <div className="categoryCardGlow" aria-hidden="true" />

                <div className="categoryCardContent">
                  <div className="categoryIcon">
                    <CategoryIcon aria-hidden="true" />
                  </div>

                  <h3>{categoryTitle}</h3>
                  <p>{getCategoryGroupText(language, category.key, "description")}</p>
                </div>

                <div className="categoryPreviewStack" aria-hidden="true">
                  {[0, 1, 2].map((index) => {
                    const product = previewProducts[index];

                    return (
                      <div
                        className={`categoryPreviewCard categoryPreviewCard${index + 1}${
                          product ? "" : " is-placeholder"
                        }`}
                        key={product?.key || `${category.key}-${index}`}
                      >
                        {product?.imageUrl ? (
                          <img src={product.imageUrl} alt="" loading="lazy" decoding="async" />
                        ) : (
                          <CategoryIcon />
                        )}
                      </div>
                    );
                  })}
                </div>

                <span className="categoryArrow" aria-hidden="true">
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
