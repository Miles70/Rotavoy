import Hero from "../components/Hero/Hero";
import FeaturedCategories from "../components/FeaturedCategories/FeaturedCategories";
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
        title="Rotavoy | Global Marketplace"
        description="Discover electronics, fashion, home, lifestyle and more on Rotavoy, a global marketplace built for modern shopping."
        path="/"
        jsonLd={structuredData}
      />
      <Hero />
      <FeaturedCategories />
      <Deals />
      <PopularProducts />
      <Newsletter />
    </>
  );
}

export default Home;
