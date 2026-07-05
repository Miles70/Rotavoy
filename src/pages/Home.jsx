import Hero from "../components/Hero/Hero";
import SearchBar from "../components/SearchBar/SearchBar";
import FeaturedCategories from "../components/FeaturedCategories/FeaturedCategories";
import Deals from "../components/Deals/Deals";
import PopularProducts from "../components/PopularProducts/PopularProducts";
import Newsletter from "../components/Newsletter/Newsletter";

function Home() {
  return (
    <>
      <Hero />
      <SearchBar />
      <FeaturedCategories />
      <Deals />
      <PopularProducts />
      <Newsletter />
    </>
  );
}

export default Home;