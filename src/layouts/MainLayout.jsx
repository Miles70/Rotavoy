import { useLayoutEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import TravelTracker from "../components/TravelTracker";
import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import { appPolicy } from "../../seo/app-policy.js";
import { useLanguage } from "../i18n/LanguageContext";
import Seo from "../components/Seo/Seo";

function MainLayout() {
  const { pathname, search } = useLocation();
  const { language } = useLanguage();
  const query = new URLSearchParams(search);
  query.set("lang", language);
  const policy = appPolicy(pathname, query.toString(), import.meta.env.VITE_SEO_HOTEL_IDS || []);


  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);

  return (
    <div className="app">
      <TravelTracker />
      {!/^\/travel\/hotels\/[^/]+$/.test(pathname) && <Seo
        title={policy.title}
        description={policy.description}
        path={policy.canonical?.replace("https://www.rotavoy.com", "") || pathname}
        noIndex={policy.noIndex}
      />}

      <Header />
      <Outlet />
      <Footer />
    </div>
  );
}

export default MainLayout;
