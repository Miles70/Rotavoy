import { SITE_URL, travelLanding, travelAlternates, languageTag } from '../../shared/travelSeo';
import { travelSeoCopy } from '../../shared/travelSeoCopy';
import { useLayoutEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import TravelTracker from "../components/TravelTracker";
import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
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
  const { pathname } = useLocation();
  const landing = travelLanding(pathname);
  const landingCopy = landing ? travelSeoCopy(landing.category, landing.language) : null;
  const staticSeo = landingCopy || STATIC_SEO[pathname] || null;
  const canonicalPath = landing?.path || (pathname === '/travel' ? '/' : pathname);
  const shouldNoIndex = ['/travel/checkout', '/flights/checkout', '/account'].some(path => pathname === path || pathname.startsWith(`${path}/`));

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);

  return (
    <div className="app">
      <TravelTracker />
      {staticSeo ? (
        <Seo
          title={staticSeo.title}
          description={staticSeo.description}
          path={canonicalPath}
          alternates={landing ? travelAlternates(landing.category) : []}
          jsonLd={landing ? { '@context': 'https://schema.org', '@type': 'WebPage', name: landingCopy.heading, description: landingCopy.description, url: `${SITE_URL}${landing.path}`, inLanguage: languageTag(landing.language), isPartOf: { '@type': 'WebSite', name: 'Rotavoy', url: SITE_URL } } : null}
        />
      ) : null}

      {shouldNoIndex ? (
        <Seo
          title="Secure Travel Account | Rotavoy"
          description="Rotavoy secure reservation and account access."
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
