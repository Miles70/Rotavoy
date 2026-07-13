import { useEffect, useState } from "react";
import { getHomeCampaign } from "../../services/homeCampaignApi";
import CampaignSlider from "./CampaignSlider";
import "./CampaignShowcase.css";

function CampaignShowcase() {
  const [campaign, setCampaign] = useState(null);

  useEffect(() => {
    let cancelled = false;

    getHomeCampaign()
      .then((data) => {
        if (!cancelled) setCampaign(data.campaign || null);
      })
      .catch(() => {
        if (!cancelled) setCampaign(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return campaign ? <CampaignSlider campaign={campaign} /> : null;
}

export default CampaignShowcase;
