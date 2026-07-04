import categories from "../../data/categories";
import "./FeaturedCategories.css";

function FeaturedCategories() {
  return (
    <section className="featuredCategories">
      <div className="container">
        <p className="sectionTag">Browse Categories</p>

        <h2>Everything you need in one place.</h2>

        <div className="categoryGrid">
          {categories.map((category) => (
            <article className="categoryCard" key={category.title}>
              <span className="categoryIcon">{category.icon}</span>
              <h3>{category.title}</h3>
              <p>{category.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default FeaturedCategories;