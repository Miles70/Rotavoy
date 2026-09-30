import { useLayoutEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import Seo from "../components/Seo/Seo";

const STATIC_SEO = {
  "/": {
    title: "Rotavoy Travel | Hotels & Global Stays",
    description: "Search hotels, compare live room offers and book global stays with Rotavoy Travel.",
  },
  "/travel": {
    title: "Rotavoy Travel | Hotels & Global Stays",
    description: "Search hotels, compare live room offers and book global stays with Rotavoy Travel.",
  },
  "/about": {
    title: "About Rotavoy Travel",
    description: "Learn about Rotavoy, a travel-first booking platform for global stays.",
  },
  "/contact": {
    title: "Contact Rotavoy Travel",
    description: "Contact Rotavoy for travel, reservation and account support.",
  },
  "/support": {
    title: "Rotavoy Travel Support",
    description: "Get help with Rotavoy hotel searches, reservations and payments.",
  },
  "/privacy": {
    title: "Privacy Policy | Rotavoy",
    description: "Read the Rotavoy privacy policy.",
  },
  "/terms": {
    title: "Terms of Service | Rotavoy",
    description: "Read the Rotavoy travel terms of service.",
  },
  "/refund": {
    title: "Cancellation & Refund Policy | Rotavoy",
    description: "Read Rotavoy cancellation and refund information for travel bookings.",
  },
};

function MainLayout() {
  const { pathname } = useLocation();
  const staticSeo = STATIC_SEO[pathname] || null;
  const shouldNoIndex = pathname === "/travel/checkout" || pathname === "/flights";

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
          title={pathname === "/flights" ? "Flights | Rotavoy" : "Secure Travel Checkout | Rotavoy"}
          description={pathname === "/flights" ? "Find and compare flights with Rotavoy." : "Rotavoy secure reservation checkout."}
          path={pathname}
          noIndex
        />
      ) : null}

      <Header />
      <Outlet />
      <Footer />
    </div>
  );
}

export default MainLayout;
