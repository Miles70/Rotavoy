import { useLayoutEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import CampaignShowcase from "../components/CampaignShowcase/CampaignShowcase";
import SearchBar from "../components/SearchBar/SearchBar";
import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import Seo from "../components/Seo/Seo";

const STATIC_SEO = {
  "/travel": {
    title: "Travel | Rotavoy",
    description: "Explore Rotavoy Travel for destination inspiration and travel-focused experiences.",
  },
  "/local": {
    title: "Local Services | Rotavoy",
    description: "Discover local services and nearby marketplace experiences with Rotavoy.",
  },
  "/about": {
    title: "About Rotavoy",
    description: "Learn about Rotavoy and the marketplace experience we are building.",
  },
  "/contact": {
    title: "Contact Rotavoy",
    description: "Contact Rotavoy for marketplace, account and customer support questions.",
  },
  "/support": {
    title: "Rotavoy Support",
    description: "Get help with Rotavoy shopping, orders, accounts and marketplace services.",
  },
  "/privacy": {
    title: "Privacy Policy | Rotavoy",
    description: "Read the Rotavoy privacy policy.",
  },
  "/terms": {
    title: "Terms of Service | Rotavoy",
    description: "Read the Rotavoy terms of service.",
  },
  "/refund": {
    title: "Refund Policy | Rotavoy",
    description: "Read the Rotavoy refund and return policy.",
  },
};

function MainLayout() {
  const { pathname } = useLocation();
  const staticSeo = STATIC_SEO[pathname] || null;
  const shouldNoIndex =
    pathname === "/cart" ||
    pathname === "/checkout" ||
    pathname === "/order-success" ||
    pathname.startsWith("/account/") ||
    pathname === "/account";

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);

  return (
    <div className="app">
      {staticSeo ? (
        <Seo
          title={staticSeo.title}
          description={staticSeo.description}
          path={pathname}
        />
      ) : null}
      {shouldNoIndex ? (
        <Seo
          title="Rotavoy"
          description="Rotavoy account and checkout area."
          path={pathname}
          noIndex
        />
      ) : null}
      <Header />
      {pathname === "/" ? <CampaignShowcase /> : null}
      {pathname === "/" ? <SearchBar /> : null}
      <Outlet />
      <Footer />
    </div>
  );
}

export default MainLayout;
