import Hero from "../components/Hero/Hero";
import FeaturedCategories from "../components/FeaturedCategories/FeaturedCategories";
import HomeTravelSpotlight from "../components/HomeTravelSpotlight/HomeTravelSpotlight";
import Deals from "../components/Deals/Deals";
import PopularProducts from "../components/PopularProducts/PopularProducts";
import Newsletter from "../components/Newsletter/Newsletter";
import Seo from "../components/Seo/Seo";

function Home() {
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Rotavoy",
      url: "https://rotavoy.com/",
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Rotavoy",
      url: "https://rotavoy.com/",
    },
  ];

  return (
    <>
      <Seo
        title="Rotavoy | Global Marketplace & Travel"
        description="Shop global products and discover live hotel availability with Rotavoy Marketplace & Travel."
        path="/"
        jsonLd={structuredData}
      />
      <Hero />
      <HomeTravelSpotlight />
      <FeaturedCategories />
      <Deals />
      <PopularProducts />
      <Newsletter />
    </>
  );
}

export default Home;
