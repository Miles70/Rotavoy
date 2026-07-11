import { useSearchParams } from "react-router-dom";
import products from "../data/products";
import ProductCard from "../components/ProductCard/ProductCard";
import { useLanguage } from "../i18n/LanguageContext";
import "./Products.css";

function Products() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();

  const searchQuery =
    searchParams.get("search")?.trim().toLowerCase() || "";

  const categoryQuery =
    searchParams.get("category")?.trim().toLowerCase() || "";

  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      !categoryQuery || product.categoryKey === categoryQuery;

    if (!matchesCategory) {
      return false;
    }

    if (!searchQuery) {
      return true;
    }

    const categoryTitle = t(
      `categories.${product.categoryKey}.title`
    );

    const searchableText = [
      product.title,
      product.categoryKey,
      categoryTitle,
      String(product.price),
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(searchQuery);
  });

  const selectedCategoryTitle = categoryQuery
    ? t(`categories.${categoryQuery}.title`)
    : "";

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
              {selectedCategoryTitle ||
                t("productsPage.listTitle")}
            </h2>

            {searchQuery && (
              <p className="productsSearchInfo">
                Search:{" "}
                <strong>{searchParams.get("search")}</strong>
              </p>
            )}
          </div>

          <p>
            {filteredProducts.length} {t("productsPage.items")}
          </p>
        </div>

        {filteredProducts.length > 0 ? (
          <div className="productsGrid">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.key}
                product={product}
              />
            ))}
          </div>
        ) : (
          <div className="emptyProducts">
            <h3>No products found</h3>
            <p>
              Try another keyword or browse the full product list.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

export default Products;