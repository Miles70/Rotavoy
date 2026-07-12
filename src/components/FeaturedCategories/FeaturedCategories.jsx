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
import categories from "../../data/categories";
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
  const { t } = useLanguage();

  return (
    <section className="featuredCategories">
      <div className="container">
        <p className="sectionTag">{t("featuredCategories.tag")}</p>
        <h2>{t("featuredCategories.title")}</h2>

        <div className="categoryGrid">
          {categories.map((category) => {
            const CategoryIcon = categoryIcons[category.key] || Sparkles;
            const categoryTitle = t(`categoryGroups.${category.key}.title`);

            return (
              <Link
                className="categoryCard"
                key={category.key}
                to={`/products?group=${category.key}&page=1`}
                aria-label={categoryTitle}
              >
                <div className="categoryIcon">
                  <CategoryIcon aria-hidden="true" />
                </div>

                <h3>{categoryTitle}</h3>
                <p>{t(`categoryGroups.${category.key}.description`)}</p>

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
