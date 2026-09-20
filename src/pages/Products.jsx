import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, PackageSearch } from "lucide-react";
import { useParams, useSearchParams } from "react-router-dom";
import ProductCard from "../components/ProductCard/ProductCard";
import SearchBar from "../components/SearchBar/SearchBar";
import Seo from "../components/Seo/Seo";
import categories from "../data/categories";
import { getCategoryGroupText } from "../i18n/categoryGroupText";
import { useLanguage } from "../i18n/LanguageContext";
import { getStoreProducts } from "../services/productsApi";
import "./Products.css";

const PAGE_SIZE = 24;
const recommendationLabels = {
  en: { title: "You may also like", text: "Popular products from the same collection." },
  tr: { title: "Bunları da beğenebilirsin", text: "Aynı koleksiyondan popüler ürünler." },
  ru: { title: "Вам также может понравиться", text: "Популярные товары из той же коллекции." },
  ar: { title: "قد يعجبك أيضاً", text: "منتجات شائعة من المجموعة نفسها." },
  zh: { title: "你可能还喜欢", text: "同一系列中的热门商品。" },
  es: { title: "También te puede gustar", text: "Productos populares de la misma colección." },
  pt: { title: "Você também pode gostar", text: "Produtos populares da mesma coleção." },
  fr: { title: "Vous aimerez peut-être aussi", text: "Produits populaires de la même collection." },
  de: { title: "Das könnte dir auch gefallen", text: "Beliebte Produkte aus derselben Kollektion." },
  it: { title: "Potrebbero piacerti anche", text: "Prodotti popolari della stessa collezione." },
};
const productsPageDescriptions = {
  en: "Explore the full marketplace across nine clear product collections.",
  tr: "Dokuz ana koleksiyondaki ürünleri keşfet, ara ve sayfa sayfa gez.",
  ru: "Изучайте товары маркетплейса в девяти понятных коллекциях.",
  ar: "استكشف منتجات السوق ضمن تسع مجموعات واضحة.",
  zh: "浏览九个清晰商品集合中的完整市场产品。",
  es: "Explora todo el marketplace a través de nueve colecciones de productos bien definidas.",
  pt: "Explore todo o marketplace em nove coleções de produtos bem definidas.",
  fr: "Explorez toute la marketplace à travers neuf collections de produits clairement définies.",
  de: "Entdecke den gesamten Marktplatz in neun übersichtlichen Produktkollektionen.",
  it: "Esplora l'intero marketplace attraverso nove collezioni di prodotti ben definite.",
};

function getPageItems(currentPage, totalPages) {
  if (totalPages <= 9) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items = [1];
  const start = Math.max(2, currentPage - 2);
  const end = Math.min(totalPages - 1, currentPage + 2);

  if (start > 2) items.push("start-ellipsis");
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < totalPages - 1) items.push("end-ellipsis");
  items.push(totalPages);

  return items;
}

function categoryLabel(categoryKey, t) {
  if (!categoryKey) return "";
  const translationKey = `categories.${categoryKey}.title`;
  const translated = t(translationKey);

  if (translated !== translationKey) return translated;

  return categoryKey
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function groupLabel(groupKey, language) {
  if (!categories.some((category) => category.key === groupKey)) return "";
  return getCategoryGroupText(language, groupKey, "title");
}

function Products() {
  const { t, language } = useLanguage();
  const { groupKey = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const searchQuery = searchParams.get("search")?.trim() || "";
  const categoryQuery = searchParams.get("category")?.trim().toLowerCase() || "";
  const legacyGroupQuery = searchParams.get("group")?.trim() || "";
  const groupQuery = groupKey.trim() || legacyGroupQuery;
  const isValidGroup = !groupQuery || categories.some((category) => category.key === groupQuery);
  const requestedPage = Math.max(Number.parseInt(searchParams.get("page"), 10) || 1, 1);

  useEffect(() => {
    let isCancelled = false;

    setIsLoading(true);
    setError("");
    setRecommendations([]);

    getStoreProducts({
      page: requestedPage,
      limit: PAGE_SIZE,
      search: searchQuery,
      category: categoryQuery,
      group: groupQuery,
      language,
    })
      .then((data) => {
        if (isCancelled) return;

        setProducts(data.products || []);
        setRecommendations(data.recommendations || []);
        setPagination(data.pagination || {});

        if (data.pagination?.page && data.pagination.page !== requestedPage) {
          const nextParams = new URLSearchParams(searchParams);
          nextParams.set("page", String(data.pagination.page));
          setSearchParams(nextParams, { replace: true });
        }
      })
      .catch((requestError) => {
        if (!isCancelled) {
          setProducts([]);
          setRecommendations([]);
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [categoryQuery, groupQuery, language, requestedPage, searchQuery, searchParams, setSearchParams]);

  const pageItems = useMemo(
    () => getPageItems(pagination.page || 1, pagination.totalPages || 1),
    [pagination.page, pagination.totalPages],
  );

  const selectedCategoryTitle =
    groupLabel(groupQuery, language) || categoryLabel(categoryQuery, t);
  const recommendationText = recommendationLabels[language] || recommendationLabels.en;
  const seoPage = pagination.page || requestedPage;
  const seoParams = new URLSearchParams();
  if (categoryQuery) seoParams.set("category", categoryQuery);
  if (seoPage > 1) seoParams.set("page", String(seoPage));
  const seoPath = searchQuery
    ? "/products"
    : `${groupQuery ? `/category/${groupQuery}` : "/products"}${seoParams.toString() ? `?${seoParams.toString()}` : ""}`;
  const seoTitle = selectedCategoryTitle
    ? `${selectedCategoryTitle} Products${seoPage > 1 ? ` - Page ${seoPage}` : ""} | Rotavoy`
    : `Shop Products${seoPage > 1 ? ` - Page ${seoPage}` : ""} | Rotavoy`;
  const seoDescription = selectedCategoryTitle
    ? `Shop ${selectedCategoryTitle} products on Rotavoy. Discover in-stock items, variants and current marketplace prices.`
    : "Shop electronics, fashion, home, beauty, sports, toys and more across the Rotavoy marketplace.";

  function changePage(nextPage) {
    if (nextPage < 1 || nextPage > pagination.totalPages || nextPage === pagination.page) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", String(nextPage));
    setSearchParams(nextParams);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="productsPage">
      <Seo
        title={seoTitle}
        description={seoDescription}
        path={seoPath}
        noIndex={Boolean(searchQuery) || !isValidGroup}
        previousPath={seoPage > 1
          ? `${groupQuery ? `/category/${groupQuery}` : "/products"}${seoPage > 2 ? `?page=${seoPage - 1}` : ""}`
          : ""}
        nextPath={pagination.hasNextPage
          ? `${groupQuery ? `/category/${groupQuery}` : "/products"}?page=${seoPage + 1}`
          : ""}
        jsonLd={searchQuery ? null : {
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "CollectionPage",
              name: selectedCategoryTitle || "Rotavoy Products",
              description: seoDescription,
              url: `https://rotavoy.com${seoPath}`,
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Rotavoy", item: "https://rotavoy.com/" },
                ...(selectedCategoryTitle ? [{
                  "@type": "ListItem",
                  position: 2,
                  name: selectedCategoryTitle,
                  item: `https://rotavoy.com/category/${groupQuery}`,
                }] : []),
              ],
            },
          ],
        }}
      />
      <section className="productsHero">
        <span>{t("productsPage.tag")}</span>
        <h1>{t("productsPage.title")}</h1>
        <p>{productsPageDescriptions[language] || productsPageDescriptions.en}</p>

        <div className="productsPageSearch">
          <SearchBar initialValue={searchQuery} />
        </div>
      </section>

      <section className="productsListSection">
        <div className="productsListHeader">
          <div>
            <span>{t("productsPage.listTag")}</span>
            <h2>{selectedCategoryTitle || t("productsPage.listTitle")}</h2>

            {searchQuery ? (
              <p className="productsSearchInfo">
                Search: <strong>{searchQuery}</strong>
              </p>
            ) : null}
          </div>

          <p>
            {isLoading ? "—" : pagination.total || 0} {t("productsPage.items")}
          </p>
        </div>

        {error ? (
          <div className="emptyProducts productsApiError">
            <PackageSearch size={28} />
            <div>
              <h3>Products could not be loaded</h3>
              <p>{error}. Make sure the backend server is running.</p>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className="productsGrid productsLoadingGrid" aria-label="Loading products">
            {Array.from({ length: 12 }, (_, index) => (
              <div className="productLoadingCard" key={index} />
            ))}
          </div>
        ) : null}

        {!isLoading && !error && products.length > 0 ? (
          <>
            <div className="productsGrid">
              {products.map((product) => (
                <ProductCard key={product.key} product={product} />
              ))}
            </div>

            {pagination.totalPages > 1 ? (
              <nav className="storePagination" aria-label="Product pages">
                <button
                  type="button"
                  className="storePaginationArrow"
                  disabled={!pagination.hasPreviousPage}
                  onClick={() => changePage(pagination.page - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={18} />
                </button>

                <div className="storePaginationNumbers">
                  {pageItems.map((item) =>
                    typeof item === "number" ? (
                      <button
                        type="button"
                        key={item}
                        className={item === pagination.page ? "is-active" : ""}
                        onClick={() => changePage(item)}
                        aria-current={item === pagination.page ? "page" : undefined}
                      >
                        {item}
                      </button>
                    ) : (
                      <span key={item}>…</span>
                    ),
                  )}
                </div>

                <button
                  type="button"
                  className="storePaginationArrow"
                  disabled={!pagination.hasNextPage}
                  onClick={() => changePage(pagination.page + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight size={18} />
                </button>
              </nav>
            ) : null}
          </>
        ) : null}

        {!isLoading && !error && products.length === 0 ? (
          <div className="emptyProducts">
            <h3>No products found</h3>
            <p>Try another keyword or browse the full product list.</p>
          </div>
        ) : null}

        {!isLoading && !error && searchQuery && recommendations.length > 0 ? (
          <section className="productsRecommendations">
            <div className="productsRecommendationHeader">
              <span>{recommendationText.title}</span>
              <h2>{recommendationText.title}</h2>
              <p>{recommendationText.text}</p>
            </div>
            <div className="productsGrid">
              {recommendations.map((product) => (
                <ProductCard key={`recommendation-${product.key}`} product={product} />
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

export default Products;
