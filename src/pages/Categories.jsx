import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Baby,
  BookOpen,
  Cpu,
  Dumbbell,
  House,
  PackageCheck,
  Shirt,
  ShoppingBasket,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Link } from "react-router-dom";
import ProductCard from "../components/ProductCard/ProductCard";
import categories from "../data/categories";
import { getCategoryGroupText } from "../i18n/categoryGroups";
import { useLanguage } from "../i18n/LanguageContext";
import { getStoreProducts } from "../services/productsApi";
import "./Categories.css";

const pageTranslations = {
  en: {
    tag: "Categories",
    title: "Shop by category.",
    text: "Browse the marketplace through nine clear collections and reach the right products faster.",
    collections: "Collections",
    products: "Products",
    globalStore: "Global Store",
    quickBrowse: "Quick Browse",
    featured: "Featured Picks",
    viewAll: "View All",
    ready: "Ready to explore",
    loading: "Loading categories...",
  },
  tr: {
    tag: "Kategoriler",
    title: "Kategoriye göre alışveriş yap.",
    text: "Pazaryerini dokuz net koleksiyon üzerinden gez ve aradığın ürünlere daha hızlı ulaş.",
    collections: "Koleksiyon",
    products: "Ürün",
    globalStore: "Global Mağaza",
    quickBrowse: "Hızlı Gezin",
    featured: "Öne Çıkanlar",
    viewAll: "Tümünü Gör",
    ready: "Keşfetmeye hazır",
    loading: "Kategoriler yükleniyor...",
  },
  ru: {
    tag: "Категории",
    title: "Покупайте по категориям.",
    text: "Просматривайте маркетплейс через девять понятных коллекций и быстрее находите нужные товары.",
    collections: "Коллекции",
    products: "Товары",
    globalStore: "Глобальный магазин",
    quickBrowse: "Быстрый просмотр",
    featured: "Избранное",
    viewAll: "Посмотреть все",
    ready: "Готово к просмотру",
    loading: "Категории загружаются...",
  },
  ar: {
    tag: "الفئات",
    title: "تسوق حسب الفئة.",
    text: "تصفح السوق عبر تسع مجموعات واضحة واعثر على المنتجات المناسبة بسرعة أكبر.",
    collections: "المجموعات",
    products: "المنتجات",
    globalStore: "متجر عالمي",
    quickBrowse: "تصفح سريع",
    featured: "اختيارات مميزة",
    viewAll: "عرض الكل",
    ready: "جاهز للاستكشاف",
    loading: "جارٍ تحميل الفئات...",
  },
  zh: {
    tag: "分类",
    title: "按分类购物。",
    text: "通过九个清晰的商品集合浏览市场，更快找到合适的产品。",
    collections: "系列",
    products: "商品",
    globalStore: "全球商店",
    quickBrowse: "快速浏览",
    featured: "精选商品",
    viewAll: "查看全部",
    ready: "随时探索",
    loading: "正在加载分类...",
  },
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

function Categories() {
  const { t, language } = useLanguage();
  const copy = pageTranslations[language] || pageTranslations.en;
  const [categoryData, setCategoryData] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    Promise.allSettled(
      categories.map((category) =>
        getStoreProducts({
          page: 1,
          limit: 8,
          group: category.key,
          sort: "popular",
        }),
      ),
    )
      .then((results) => {
        if (isCancelled) return;

        const nextData = {};
        results.forEach((result, index) => {
          const category = categories[index];
          nextData[category.key] =
            result.status === "fulfilled"
              ? {
                  products: result.value.products || [],
                  total: Number(result.value.pagination?.total || 0),
                }
              : { products: [], total: 0 };
        });

        setCategoryData(nextData);
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  const totalProducts = useMemo(
    () => categories.reduce((sum, category) => sum + Number(categoryData[category.key]?.total || 0), 0),
    [categoryData],
  );

  return (
    <main className="categoriesPage">
      <section className="categoriesHero">
        <span>{copy.tag}</span>
        <h1>{copy.title}</h1>
        <p>{copy.text}</p>
      </section>

      <section className="categoriesOverview">
        <div className="categoryStat">
          <strong>{categories.length}</strong>
          <span>{copy.collections}</span>
        </div>

        <div className="categoryStat">
          <strong>{isLoading ? "—" : totalProducts.toLocaleString("en-US")}</strong>
          <span>{copy.products}</span>
        </div>

        <div className="categoryStat categoryStatWide">
          <PackageCheck size={22} />
          <div>
            <strong>{copy.globalStore}</strong>
            <span>{isLoading ? copy.loading : copy.ready}</span>
          </div>
        </div>
      </section>

      <section className="categoryQuickBrowse">
        <div className="categoryQuickBrowseHeader">
          <Sparkles size={17} />
          <span>{copy.quickBrowse}</span>
        </div>

        <nav className="categoryQuickNav">
          {categories.map((category) => {
            const CategoryIcon = categoryIcons[category.key] || Sparkles;

            return (
              <a
                key={category.key}
                href={`#category-${category.key}`}
                className="categoryQuickLink"
              >
                <span>
                  <CategoryIcon aria-hidden="true" />
                </span>
                {getCategoryGroupText(language, category.key, "title")}
              </a>
            );
          })}
        </nav>
      </section>

      <section className="categoryGroups">
        {categories.map((category) => {
          const CategoryIcon = categoryIcons[category.key] || Sparkles;
          const groupData = categoryData[category.key] || { products: [], total: 0 };
          const previewProducts = groupData.products.slice(0, 3);
          const categoryTitle = getCategoryGroupText(language, category.key, "title");
          const categoryDescription = getCategoryGroupText(language, category.key, "description");
          const productsPath = `/products?group=${category.key}&page=1`;

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
                    <CategoryIcon aria-hidden="true" />
                  </div>

                  <div>
                    <span>{categoryTitle}</span>
                    <h2>{categoryDescription}</h2>
                  </div>
                </div>

                <div className="categoryGroupActions">
                  <p>
                    {isLoading ? "—" : groupData.total.toLocaleString("en-US")} {t("categoriesPage.items")}
                  </p>
                  <Link to={productsPath}>
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
                  <Link to={productsPath}>
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
                      <img src={product.imageUrl} alt={product.title} loading="lazy" />
                      <span>{product.title}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="categoryProductsGrid">
                {groupData.products.map((product) => (
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
