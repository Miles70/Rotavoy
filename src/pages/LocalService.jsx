import { Link, Navigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  MapPinned,
  RefreshCcw,
  ShoppingBasket,
  UtensilsCrossed,
} from "lucide-react";

import { useLanguage } from "../i18n/LanguageContext";

import "./LocalServices.css";

const serviceConfig = {
  supermarket: {
    key: "supermarket",
    Icon: ShoppingBasket,
  },
  restaurants: {
    key: "restaurants",
    Icon: UtensilsCrossed,
  },
  "second-hand": {
    key: "secondHand",
    Icon: RefreshCcw,
  },
  nearby: {
    key: "nearby",
    Icon: MapPinned,
  },
};

function LocalService() {
  const { serviceKey } = useParams();
  const { t } = useLanguage();
  const service = serviceConfig[serviceKey];

  if (!service) {
    return <Navigate to="/local" replace />;
  }

  const { key, Icon } = service;

  return (
    <main className="localServicesPage localServiceDetailPage">
      <Link className="localServiceBack" to="/local">
        <ArrowLeft size={17} />
        {t("localPage.back")}
      </Link>

      <section className="localServiceDetail">
        <span className="localServiceDetailIcon" aria-hidden="true">
          <Icon size={34} />
        </span>

        <span className="localServicesEyebrow">
          {t("localPage.serviceEyebrow")}
        </span>

        <span className="localServiceDetailStatus">
          {t("localPage.comingSoon")}
        </span>

        <h1>{t(`localPage.services.${key}.title`)}</h1>
        <p>{t(`localPage.services.${key}.description`)}</p>
        <small>{t("localPage.serviceText")}</small>
      </section>
    </main>
  );
}

export default LocalService;
