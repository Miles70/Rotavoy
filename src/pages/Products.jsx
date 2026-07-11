import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ProductCard from "../components/ProductCard/ProductCard";
import { useLanguage } from "../i18n/LanguageContext";
import { getProducts } from "../services/productsApi";
import "./Products.css";

const pageCopy = {
  en: {
    loading: "Loading products...",
    error: "Products could not be loaded.",
    retry: "Try again",
    emptyTitle: "No products found",
    emptyText: "Try another keyword or browse the full product list.",
    previous: "Previous",
    next: "Next",
    page: "Page",
    search: "Search",
  },
  tr: {
    loading: "Ürünler yükleniyor...",
    error: "Ürünler yüklenemedi.",
    retry: "Tekrar dene",
    emptyTitle: "Ürün bulunamadı",
    emptyText: "Başka bir kelime dene veya tüm ürünleri görüntüle.",
    previous: "Önceki",
    next: "Sonraki",
    page: "Sayfa",
    search: "Arama",
  },
  ru: {
    loading: "Загрузка товаров...",
    error: "Не удалось загрузить товары.",
    retry: "Повторить",
    emptyTitle: "Товары не найдены",
    emptyText: "Попробуйте другой запрос или откройте весь каталог.",
    previous: "Назад",
    next: "Далее",
    page: "Страница",
    search: "Поиск",
  },
  ar: {
    loading: "جارٍ تحميل المنتجات...",
    error: "تعذر تحميل المنتجات.",
    retry: "حاول مجدداً",
    emptyTitle: "لم يتم العثور على منتجات",
    emptyText: "جرّب كلمة أخرى أو تصفح جميع المنتجات.",
    previous: "السابق",
    next: "التالي",
    page: "الصفحة",
    search: "بحث",
  },
  zh: {
    loading: "正在加载商品...",
    error: "无法加载商品。",
    retry: "重试",
    emptyTitle: "未找到商品",
    emptyText: "请尝试其他关键词或浏览全部商品。",
    previous: "上一页",
    next: "下一页",
    page: "页码",
    search: "搜索",
  },
};

function Products() {
  const { t, language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  });
  const [status, setStatus] = useState("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const copy = pageCopy[language] || pageCopy.en;

  const rawSearch = searchParams.get("search")?.trim() || "";
  const categoryQuery = searchParams.get("category")?.trim() || "";
  const requestedPage = Math.max(
    1,
    Number.parseInt(searchParams.get("page") || "1", 10) || 1
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      try {
        setStatus("loading");
        const payload = await getProducts(
          {
            page: requestedPage,
            limit: 24,
            search: rawSearch,
            category: categoryQuery,
            sort: "popular",
          },
          { signal: controller.signal }
        );

        setProducts(payload.products || []);
        setMeta(
          payload.meta || {
            page: 1,
            total: 0,
            totalPages: 1,
            hasNext: false,
            hasPrevious: false,
          }
        );
        setStatus("success");
      } catch (error) {
        if (error.name === "AbortError") return;
        console.error(error);
        setStatus("error");
      }
    }

    loadProducts();
    return () => controller.abort();
  }, [requestedPage, rawSearch, categoryQuery, reloadKey]);

  const selectedCategoryTitle = useMemo(() => {
    if (!categoryQuery) return "";
    return products[0]?.categoryLabel || categoryQuery.replace(/-/g, " ");
  }, [categoryQuery, products]);

  function changePage(nextPage) {
    const nextParams = new URLSearchParams(searchParams);

    if (nextPage <= 1) nextParams.delete("page");
    else nextParams.set("page", String(nextPage));

    setSearchParams(nextParams);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="productsPage">
      <section className="productsHero">
        <span>{t("productsPage.tag")}</span>
        <h1>{t("productsPage.title")}</h1>
        <p>{t("productsPage.text")}</p>
      </section>

      <section className="productsListSection">
        <div className="productsListHeader">
          <div>
            <span>{t("productsPage.listTag")}</span>
            <h2>
              {selectedCategoryTitle || t("productsPage.listTitle")}
            </h2>

            {rawSearch && (
              <p className="productsSearchInfo">
                {copy.search}: <strong>{rawSearch}</strong>
              </p>
            )}
          </div>

          <p>
            {meta.total} {t("productsPage.items")}
          </p>
        </div>

        {status === "loading" && (
          <div className="productsStateBox">{copy.loading}</div>
        )}

        {status === "error" && (
          <div className="productsStateBox productsStateError">
            <p>{copy.error}</p>
            <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
              {copy.retry}
            </button>
          </div>
        )}

        {status === "success" && products.length > 0 && (
          <>
            <div className="productsGrid">
              {products.map((product) => (
                <ProductCard key={product.key} product={product} />
              ))}
            </div>

            {meta.totalPages > 1 && (
              <nav className="productsPagination" aria-label="Product pages">
                <button
                  type="button"
                  disabled={!meta.hasPrevious}
                  onClick={() => changePage(meta.page - 1)}
                >
                  {copy.previous}
                </button>

                <span>
                  {copy.page} <strong>{meta.page}</strong> / {meta.totalPages}
                </span>

                <button
                  type="button"
                  disabled={!meta.hasNext}
                  onClick={() => changePage(meta.page + 1)}
                >
                  {copy.next}
                </button>
              </nav>
            )}
          </>
        )}

        {status === "success" && products.length === 0 && (
          <div className="emptyProducts">
            <h3>{copy.emptyTitle}</h3>
            <p>{copy.emptyText}</p>
          </div>
        )}
      </section>
    </main>
  );
}

export default Products;
