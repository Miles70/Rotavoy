import { useLayoutEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import TravelTracker from "../components/TravelTracker";
import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import { appPolicy } from "../../seo/app-policy.js";
import { useLanguage } from "../i18n/LanguageContext";
import Seo from "../components/Seo/Seo";

const STATIC_SEO = {
  "/hotels": { title: "Hotels | Rotavoy", description: "Find hotels and compare live room offers with Rotavoy." },
  "/cars": { title: "Car Rental | Rotavoy", description: "Plan your car rental with Rotavoy." },
  "/activities": { title: "Activities | Rotavoy", description: "Plan tours and activities with Rotavoy." },
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
  const { pathname, search } = useLocation();
  const { language } = useLanguage();
  const query = new URLSearchParams(search);
  query.set("lang", language);
  const policy = appPolicy(pathname, query.toString());
  const staticSeo = STATIC_SEO[pathname] || null;


  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);

  return (
    <div className="app">
      <TravelTracker />
      <Seo
        title={language === "en" && staticSeo ? staticSeo.title : policy.title}
        description={language === "en" && staticSeo ? staticSeo.description : policy.description}
        path={policy.canonical?.replace("https://www.rotavoy.com", "") || pathname}
        noIndex={policy.noIndex}
      />

      <Header />
      <Outlet />
      <Footer />
    </div>
  );
}

export default MainLayout;
