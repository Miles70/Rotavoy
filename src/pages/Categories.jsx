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
import Seo from "../components/Seo/Seo";
import categories from "../data/categories";
import { getCategoryGroupText } from "../i18n/categoryGroupText";
import { useLanguage } from "../i18n/LanguageContext";
import { getFeaturedCategoryProducts } from "../services/productsApi";
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
    text: "通过九个清晰商品集合浏览市场，更快找到合适的产品。",
    collections: "系列",
    products: "商品",
    globalStore: "全球商店",
    quickBrowse: "快速浏览",
    featured: "精选商品",
    viewAll: "查看全部",
    ready: "随时探索",
    loading: "正在加载分类...",
  },
  es: {
    tag: "Categorías",
    title: "Compra por categoría.",
    text: "Explora el marketplace a través de nueve colecciones claras y encuentra más rápido los productos adecuados.",
    collections: "Colecciones",
    products: "Productos",
    globalStore: "Tienda global",
    quickBrowse: "Exploración rápida",
    featured: "Selección destacada",
    viewAll: "Ver todo",
    ready: "Listo para explorar",
    loading: "Cargando categorías...",
  },
  pt: {
    tag: "Categorias",
    title: "Compre por categoria.",
    text: "Explore o marketplace por nove coleções bem definidas e encontre os produtos certos com mais rapidez.",
    collections: "Coleções",
    products: "Produtos",
    globalStore: "Loja global",
    quickBrowse: "Navegação rápida",
    featured: "Destaques",
    viewAll: "Ver tudo",
    ready: "Pronto para explorar",
    loading: "Carregando categorias...",
  },
  fr: {
    tag: "Catégories",
    title: "Achetez par catégorie.",
    text: "Parcourez la marketplace à travers neuf collections claires et trouvez plus rapidement les bons produits.",
    collections: "Collections",
    products: "Produits",
    globalStore: "Boutique mondiale",
    quickBrowse: "Navigation rapide",
    featured: "Sélection du moment",
    viewAll: "Tout voir",
    ready: "Prêt à explorer",
    loading: "Chargement des catégories...",
  },
  de: {
    tag: "Kategorien",
    title: "Nach Kategorie einkaufen.",
    text: "Durchsuche den Marktplatz in neun übersichtlichen Kollektionen und finde schneller die passenden Produkte.",
    collections: "Kollektionen",
    products: "Produkte",
    globalStore: "Globaler Shop",
    quickBrowse: "Schnellnavigation",
    featured: "Empfehlungen",
    viewAll: "Alle ansehen",
    ready: "Bereit zum Entdecken",
    loading: "Kategorien werden geladen...",
  },
  it: {
    tag: "Categorie",
    title: "Acquista per categoria.",
    text: "Esplora il marketplace attraverso nove collezioni ben definite e trova più rapidamente i prodotti giusti.",
    collections: "Collezioni",
    products: "Prodotti",
    globalStore: "Negozio globale",
    quickBrowse: "Esplorazione rapida",
    featured: "Prodotti in evidenza",
    viewAll: "Vedi tutto",
    ready: "Pronto da esplorare",
    loading: "Caricamento categorie...",
  },
};

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

function Categories() {
  const { t, language } = useLanguage();
  const copy = pageTranslations[language] || pageTranslations.en;
  const numberLocale = numberLocales[language] || numberLocales.en;
  const [categoryData, setCategoryData] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    setIsLoading(true);
    getFeaturedCategoryProducts(language)
      .then((result) => {
        if (!isCancelled) setCategoryData(result.categories || {});
      })
      .catch(() => {
        if (!isCancelled) setCategoryData({});
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [language]);

  const totalProducts = useMemo(
    () => categories.reduce((sum, category) => sum + Number(categoryData[category.key]?.total || 0), 0),
    [categoryData],
  );

  return (
    <main className="categoriesPage">
      <Seo
        title="Shop by Category | Rotavoy"
        description="Browse Rotavoy collections across electronics, fashion, home, beauty, sports, toys and more."
        path="/categories"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Rotavoy Categories",
          url: "https://rotavoy.com/categories",
        }}
      />
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
          <strong>{isLoading ? "—" : totalProducts.toLocaleString(numberLocale)}</strong>
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
          const productsPath = `/category/${category.slug}`;

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
                    {isLoading ? "—" : groupData.total.toLocaleString(numberLocale)} {t("categoriesPage.items")}
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
