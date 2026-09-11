import { Link } from "react-router-dom";
import { FaFacebookF, FaInstagram, FaXTwitter, FaYoutube } from "react-icons/fa6";
import { useLanguage } from "../../i18n/LanguageContext";
import siteConfig from "../../config/site";
import "./Footer.css";

function Footer() {
  const currentYear = new Date().getFullYear();
  const { t } = useLanguage();

  return (
    <footer className="footer">
      <div className="container footerInner">
        <div className="footerBrand">
          <Link to="/" className="footerLogo">
            {siteConfig.brandName}
          </Link>

          <p>{siteConfig.description}</p>

          <div className="socialLinks" aria-label="Rotavoy sosyal medya hesapları yakında">
            <span aria-label="Facebook yakında"><FaFacebookF /></span>
            <span aria-label="Instagram yakında"><FaInstagram /></span>
            <span aria-label="X yakında"><FaXTwitter /></span>
            <span aria-label="YouTube yakında"><FaYoutube /></span>
          </div>
        </div>

        <div className="footerColumn">
          <h3>{t("footer.shop")}</h3>
          <Link to="/products">{t("footer.products")}</Link>
          <Link to="/categories">{t("footer.categories")}</Link>
          <Link to="/cart">{t("footer.cart")}</Link>
        </div>

        <div className="footerColumn">
          <h3>{t("footer.company")}</h3>
          <Link to="/about">{t("footer.about")}</Link>
          <Link to="/contact">{t("footer.contact")}</Link>
          <Link to="/support">{t("footer.support")}</Link>
        </div>

        <div className="footerColumn">
          <h3>{t("footer.legal")}</h3>
          <Link to="/privacy">{t("footer.privacy")}</Link>
          <Link to="/terms">{t("footer.terms")}</Link>
          <Link to="/refund">{t("footer.refund")}</Link>
        </div>
      </div>

      <div className="container footerBottom">
        <p>
          © {currentYear} {siteConfig.brandName}. {t("footer.rights")}
        </p>
      </div>
    </footer>
  );
}

export default Footer;
