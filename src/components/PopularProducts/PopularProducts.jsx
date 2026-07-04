import products from "../../data/products";
import ProductCard from "../ProductCard/ProductCard";
import "./PopularProducts.css";

function PopularProducts() {
  return (
    <section className="popularProducts">
      <div className="container">
        <p className="sectionTag">Popular Products</p>

        <h2>Customer favorites.</h2>

        <div className="productsGrid">
          {products.map((product) => (
            <ProductCard key={product.title} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default PopularProducts;