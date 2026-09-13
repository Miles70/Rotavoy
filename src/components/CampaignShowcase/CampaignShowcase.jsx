import { useEffect, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { getHomeCampaign } from "../../services/homeCampaignApi";
import CampaignSlider from "./CampaignSlider";
import "./CampaignShowcase.css";

function CampaignShowcase() {
  const { language } = useLanguage();
  const [campaign, setCampaign] = useState(null);

  useEffect(() => {
    let cancelled = false;

    getHomeCampaign(language)
      .then((data) => {
        if (!cancelled) setCampaign(data.campaign || null);
      })
      .catch(() => {
        if (!cancelled) setCampaign(null);
      });

    return () => {
      cancelled = true;
    };
  }, [language]);

  return campaign ? <CampaignSlider campaign={campaign} /> : null;
}

export default CampaignShowcase;
