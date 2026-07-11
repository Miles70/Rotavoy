import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Briefcase,
  Car,
  Dumbbell,
  Gamepad2,
  Heart,
  House,
  Package,
  PackageCheck,
  PawPrint,
  Plug,
  Puzzle,
  Shirt,
  Smartphone,
  Sparkles,
  Wrench,
} from "lucide-react";
import ProductCard from "../components/ProductCard/ProductCard";
import { useLanguage } from "../i18n/LanguageContext";
import { getProductCategories } from "../services/productsApi";
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
    loading: "Loading categories...",
    error: "Categories could not be loaded.",
    description: "Selected products, detailed information and multiple product images.",
  },
  tr: {
    collections: "Koleksiyon",
    products: "Ürün",
    globalStore: "Global Mağaza",
    quickBrowse: "Hızlı Gezin",
    featured: "Öne Çıkanlar",
    viewAll: "Tümünü Gör",
    ready: "Keşfetmeye hazır",
    loading: "Kategoriler yükleniyor...",
    error: "Kategoriler yüklenemedi.",
    description: "Seçilmiş ürünler, detaylı bilgiler ve çoklu ürün görselleri.",
  },
  ru: {
    collections: "Коллекции",
    products: "Товары",
    globalStore: "Глобальный магазин",
    quickBrowse: "Быстрый просмотр",
    featured: "Избранное",
    viewAll: "Посмотреть все",
    ready: "Готово к просмотру",
    loading: "Загрузка категорий...",
    error: "Не удалось загрузить категории.",
    description: "Выбранные товары, подробные характеристики и несколько изображений.",
  },
  ar: {
    collections: "المجموعات",
    products: "المنتجات",
    globalStore: "متجر عالمي",
    quickBrowse: "تصفح سريع",
    featured: "اختيارات مميزة",
    viewAll: "عرض الكل",
    ready: "جاهز للاستكشاف",
    loading: "جارٍ تحميل الفئات...",
    error: "تعذر تحميل الفئات.",
    description: "منتجات مختارة ومعلومات تفصيلية وصور متعددة لكل منتج.",
  },
  zh: {
    collections: "系列",
    products: "商品",
    globalStore: "全球商店",
    quickBrowse: "快速浏览",
    featured: "精选商品",
    viewAll: "查看全部",
    ready: "随时探索",
    loading: "正在加载分类...",
    error: "无法加载分类。",
    description: "精选商品、详细信息和多张商品图片。",
  },
};

function CategoryIcon({ categoryKey, size = 26 }) {
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
  return <Icon size={size} />;
}

function Categories() {
  const { t, language } = useLanguage();
  const copy = pageTranslations[language] || pageTranslations.en;
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    const controller = new AbortController();

    async function loadCategories() {
      try {
        setStatus("loading");
        const payload = await getProductCategories({
          signal: controller.signal,
        });
        setCategories(payload.categories || []);
        setStatus("success");
      } catch (error) {
        if (error.name === "AbortError") return;
        console.error(error);
        setStatus("error");
      }
    }

    loadCategories();
    return () => controller.abort();
  }, []);

  const totalProducts = categories.reduce(
    (total, category) => total + Number(category.count || 0),
    0
  );

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
          <strong>{totalProducts}</strong>
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

      {status === "loading" && (
        <section className="categoryQuickBrowse">
          <p>{copy.loading}</p>
        </section>
      )}

      {status === "error" && (
        <section className="categoryQuickBrowse">
          <p>{copy.error}</p>
        </section>
      )}

      {status === "success" && categories.length > 0 && (
        <>
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
                  {category.title || category.key}
                </a>
              ))}
            </nav>
          </section>

          <section className="categoryGroups">
            {categories.map((category) => {
              const previewProducts = category.previewProducts || [];
              const categoryTitle = category.title || category.key;

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
                        <h2>{copy.description}</h2>
                      </div>
                    </div>

                    <div className="categoryGroupActions">
                      <p>
                        {category.count} {t("categoriesPage.items")}
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
                      <p>{copy.description}</p>

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
                    {previewProducts.map((product) => (
                      <ProductCard key={product.key} product={product} />
                    ))}
                  </div>
                </article>
              );
            })}
          </section>
        </>
      )}
    </main>
  );
}

export default Categories;
