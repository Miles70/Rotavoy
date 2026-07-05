import { useLanguage } from "../../i18n/LanguageContext";
import categories from "../../data/categories";
import "./FeaturedCategories.css";

function FeaturedCategories() {
  const { t } = useLanguage();

  return (
    <section className="featuredCategories">
      <div className="container">
        <p className="sectionTag">{t("featuredCategories.tag")}</p>

        <h2>{t("featuredCategories.title")}</h2>

        <div className="categoryGrid">
          {categories.map((category) => (
            <article className="categoryCard" key={category.key}>
              <span className="categoryIcon">{category.icon}</span>
              <h3>{t(`categories.${category.key}.title`)}</h3>
              <p>{t(`categories.${category.key}.description`)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default FeaturedCategories;