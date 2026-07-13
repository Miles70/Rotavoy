import { useEffect, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { getHomeCampaign } from "../../services/homeCampaignApi";
import "./CampaignShowcase.css";

function formatMoney(value, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(Number(value) || 0);
}

function CampaignAction({ href, children }) {
  if (/^https?:\/\//i.test(href)) {
    return (
      <a className="campaignShowcaseButton" href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }

  return (
    <Link className="campaignShowcaseButton" to={href || "/products"}>
      {children}
    </Link>
  );
}

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

  if (!campaign) return null;

  const backgroundStyle = campaign.backgroundImageUrl
    ? {
        backgroundImage: `linear-gradient(105deg, rgba(44, 10, 49, 0.96) 0%, rgba(111, 19, 84, 0.88) 48%, rgba(60, 24, 108, 0.82) 100%), url("${campaign.backgroundImageUrl}")`,
      }
    : undefined;

  return (
    <section className="campaignShowcase" style={backgroundStyle}>
      <div className="campaignShowcaseGlow campaignShowcaseGlowOne" />
      <div className="campaignShowcaseGlow campaignShowcaseGlowTwo" />

      <div className="campaignShowcaseInner">
        <div className="campaignShowcaseContent">
          <p className="campaignShowcaseEyebrow">
            <Sparkles size={16} />
            {campaign.eyebrow}
          </p>

          <h2>{campaign.title}</h2>
          <p className="campaignShowcaseDescription">{campaign.description}</p>

          <CampaignAction href={campaign.buttonUrl}>
            {campaign.buttonLabel}
            <ArrowRight size={18} />
          </CampaignAction>
        </div>

        <div className="campaignProductRail" aria-label="Campaign products">
          {(campaign.products || []).slice(0, 3).map((product) => (
            <Link
              className="campaignProductCard"
              to={`/products/${encodeURIComponent(product.key)}`}
              key={product.key}
            >
              <div className="campaignProductImage">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.title} loading="lazy" />
                ) : (
                  <span>{product.image || "🛍️"}</span>
                )}
              </div>

              <div className="campaignProductMeta">
                <strong>{product.title}</strong>
                <div className="campaignProductPrice">
                  <span>{formatMoney(product.price, product.currency)}</span>
                  {product.oldPrice ? (
                    <del>{formatMoney(product.oldPrice, product.currency)}</del>
                  ) : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default CampaignShowcase;
