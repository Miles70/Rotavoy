import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Package,
  PackageCheck,
  PawPrint,
  ShoppingBasket,
  Sparkles,
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
    descriptions: {
      marketplace: "Everyday products collected from the global open catalog.",
      groceries: "Food, drinks and pantry products from around the world.",
      beauty: "Cosmetics, personal care and beauty essentials.",
      "pet-supplies": "Food and everyday essentials for pets.",
    },
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
    descriptions: {
      marketplace: "Global açık katalogdan seçilen günlük ürünler.",
      groceries: "Dünyanın farklı yerlerinden yiyecek, içecek ve market ürünleri.",
      beauty: "Kozmetik, kişisel bakım ve güzellik ürünleri.",
      "pet-supplies": "Evcil hayvanlar için mama ve günlük ihtiyaçlar.",
    },
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
    descriptions: {
      marketplace: "Повседневные товары из глобального открытого каталога.",
      groceries: "Еда, напитки и продукты со всего мира.",
      beauty: "Косметика, уход и товары для красоты.",
      "pet-supplies": "Корм и повседневные товары для питомцев.",
    },
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
    descriptions: {
      marketplace: "منتجات يومية من الكتالوج العالمي المفتوح.",
      groceries: "أطعمة ومشروبات ومنتجات بقالة من أنحاء العالم.",
      beauty: "مستحضرات تجميل وعناية شخصية ومنتجات جمال.",
      "pet-supplies": "أغذية واحتياجات يومية للحيوانات الأليفة.",
    },
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
    descriptions: {
      marketplace: "来自全球开放目录的日常商品。",
      groceries: "来自世界各地的食品、饮料和杂货。",
      beauty: "化妆品、个人护理和美容用品。",
      "pet-supplies": "宠物食品和日常用品。",
    },
  },
};

function CategoryIcon({ categoryKey, size = 26 }) {
  if (categoryKey === "groceries") return <ShoppingBasket size={size} />;
  if (categoryKey === "beauty") return <Sparkles size={size} />;
  if (categoryKey === "pet-supplies") return <PawPrint size={size} />;
  return <Package size={size} />;
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
              const categoryDescription =
                copy.descriptions[category.key] ||
                copy.descriptions.marketplace;

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
