import { Link } from "react-router-dom";
import { ArrowRight, PackageCheck, Sparkles } from "lucide-react";
import categories from "../data/categories";
import products from "../data/products";
import ProductCard from "../components/ProductCard/ProductCard";
import { useLanguage } from "../i18n/LanguageContext";
import "./Categories.css";

const pageTranslations = {
  en: {
    collections: "Collections",
    products: "Products",
    globalStore: "Global Store",
    quickBrowse: "Quick Browse",
    featured: "Featured Picks",
    viewAll: "View All",
    ready: "Ready to explore",
  },
  tr: {
    collections: "Koleksiyon",
    products: "Ürün",
    globalStore: "Global Mağaza",
    quickBrowse: "Hızlı Gezin",
    featured: "Öne Çıkanlar",
    viewAll: "Tümünü Gör",
    ready: "Keşfetmeye hazır",
  },
  ru: {
    collections: "Коллекции",
    products: "Товары",
    globalStore: "Глобальный магазин",
    quickBrowse: "Быстрый просмотр",
    featured: "Избранное",
    viewAll: "Посмотреть все",
    ready: "Готово к просмотру",
  },
  ar: {
    collections: "المجموعات",
    products: "المنتجات",
    globalStore: "متجر عالمي",
    quickBrowse: "تصفح سريع",
    featured: "اختيارات مميزة",
    viewAll: "عرض الكل",
    ready: "جاهز للاستكشاف",
  },
  zh: {
    collections: "系列",
    products: "商品",
    globalStore: "全球商店",
    quickBrowse: "快速浏览",
    featured: "精选商品",
    viewAll: "查看全部",
    ready: "随时探索",
  },
};

function CategoryIcon({ categoryKey }) {
  if (categoryKey === "electronics") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function Categories() {
  const { t, language } = useLanguage();
  const copy = pageTranslations[language] || pageTranslations.en;

  return (
    <main className="categoriesPage">
      <section className="categoriesHero">
        <span>{t("categoriesPage.tag")}</span>
        <h1>{t("categoriesPage.title")}</h1>
        <p>{t("categoriesPage.text")}</p>
      </section>

      <section className="categoriesOverview">
        <div className="categoryStat">
          <strong>{categories.length}</strong>
          <span>{copy.collections}</span>
        </div>

        <div className="categoryStat">
          <strong>{products.length}</strong>
          <span>{copy.products}</span>
        </div>

        <div className="categoryStat categoryStatWide">
          <PackageCheck size={22} />

          <div>
            <strong>{copy.globalStore}</strong>
            <span>{copy.ready}</span>
          </div>
        </div>
      </section>

      <section className="categoryQuickBrowse">
        <div className="categoryQuickBrowseHeader">
          <Sparkles size={17} />
          <span>{copy.quickBrowse}</span>
        </div>

        <nav className="categoryQuickNav">
          {categories.map((category) => (
            <a
              key={category.key}
              href={`#category-${category.key}`}
              className="categoryQuickLink"
            >
              <span>
                <CategoryIcon categoryKey={category.key} />
              </span>

              {t(`categories.${category.key}.title`)}
            </a>
          ))}
        </nav>
      </section>

      <section className="categoryGroups">
        {categories.map((category) => {
          const categoryProducts = products.filter(
            (product) => product.categoryKey === category.key
          );

          const previewProducts = categoryProducts.slice(0, 3);
          const categoryTitle = t(`categories.${category.key}.title`);
          const categoryDescription = t(
            `categories.${category.key}.description`
          );

          return (
            <article
              className="categoryGroup"
              id={`category-${category.key}`}
              data-category={category.key}
              key={category.key}
            >
              <div className="categoryGroupHeader">
                <div className="categoryTitleBox">
                  <div className="categoryIcon">
                    <CategoryIcon categoryKey={category.key} />
                  </div>

                  <div>
                    <span>{categoryTitle}</span>
                    <h2>{categoryDescription}</h2>
                  </div>
                </div>

                <div className="categoryGroupActions">
                  <p>
                    {categoryProducts.length} {t("categoriesPage.items")}
                  </p>

                  <Link to={`/products?category=${category.key}`}>
                    {copy.viewAll}
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>

              <div className="categoryShowcase">
                <div className="categoryShowcaseContent">
                  <span>{copy.featured}</span>
                  <h3>{categoryTitle}</h3>
                  <p>{categoryDescription}</p>

                  <Link to={`/products?category=${category.key}`}>
                    {copy.viewAll}
                    <ArrowRight size={17} />
                  </Link>
                </div>

                <div className="categoryShowcaseImages">
                  {previewProducts.map((product, index) => (
                    <div
                      className={`categoryPreviewImage previewImage${index + 1}`}
                      key={product.key}
                    >
                      <img
                        src={product.imageUrl}
                        alt={product.title}
                        loading="lazy"
                      />

                      <span>{product.title}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="categoryProductsGrid">
                {categoryProducts.map((product) => (
                  <ProductCard key={product.key} product={product} />
                ))}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

export default Categories;