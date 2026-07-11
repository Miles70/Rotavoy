import { Link } from "react-router-dom";
import { useLanguage } from "../../i18n/LanguageContext";
import categories from "../../data/categories";
import "./FeaturedCategories.css";

function CategoryIcon({ categoryKey }) {
  if (categoryKey === "electronics") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect
          x="4"
          y="4"
          width="16"
          height="11"
          rx="1.8"
          stroke="currentColor"
          strokeWidth="1.9"
        />

        <path
          d="M2.8 18.5H21.2"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        />

        <path
          d="M9 18.5L9.8 16H14.2L15 18.5"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (categoryKey === "fashion") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M8.3 4L5 5.5L2.8 9.5L6.2 11.3L7.3 9.5V20H16.7V9.5L17.8 11.3L21.2 9.5L19 5.5L15.7 4C14.9 5.4 13.6 6.2 12 6.2C10.4 6.2 9.1 5.4 8.3 4Z"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (categoryKey === "home") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M3.5 10.5L12 3.5L20.5 10.5"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <path
          d="M5.5 9.5V20H18.5V9.5"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <path
          d="M9.5 20V14H14.5V20"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M8.2 8H15.8C18.7 8 21 10.3 21 13.2V16.2C21 18.1 19.5 19.6 17.6 19.6C16.5 19.6 15.5 19.1 14.9 18.2L13.8 16.5H10.2L9.1 18.2C8.5 19.1 7.5 19.6 6.4 19.6C4.5 19.6 3 18.1 3 16.2V13.2C3 10.3 5.3 8 8.2 8Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M8 11V15"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />

      <path
        d="M6 13H10"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />

      <circle cx="16.5" cy="12" r="1" fill="currentColor" />
      <circle cx="18.5" cy="14" r="1" fill="currentColor" />
    </svg>
  );
}

function FeaturedCategories() {
  const { t } = useLanguage();

  return (
    <section className="featuredCategories">
      <div className="container">
        <p className="sectionTag">{t("featuredCategories.tag")}</p>

        <h2>{t("featuredCategories.title")}</h2>

        <div className="categoryGrid">
          {categories.map((category) => {
            const categoryTitle = t(
              `categories.${category.key}.title`
            );

            return (
              <Link
                className="categoryCard"
                key={category.key}
                to={`/products?category=${category.key}`}
                aria-label={categoryTitle}
              >
                <div className="categoryIcon">
                  <CategoryIcon categoryKey={category.key} />
                </div>

                <h3>{categoryTitle}</h3>

                <p>
                  {t(`categories.${category.key}.description`)}
                </p>

                <span className="categoryArrow" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
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