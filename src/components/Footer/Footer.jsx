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

          <div className="socialLinks">
            <a href="#" aria-label="Facebook">
              <FaFacebookF />
            </a>
            <a href="#" aria-label="Instagram">
              <FaInstagram />
            </a>
            <a href="#" aria-label="X">
              <FaXTwitter />
            </a>
            <a href="#" aria-label="YouTube">
              <FaYoutube />
            </a>
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
          <Link to="/">{t("footer.about")}</Link>
          <Link to="/">{t("footer.contact")}</Link>
          <Link to="/">{t("footer.support")}</Link>
        </div>

        <div className="footerColumn">
          <h3>{t("footer.legal")}</h3>
          <Link to="/">{t("footer.privacy")}</Link>
          <Link to="/">{t("footer.terms")}</Link>
          <Link to="/">{t("footer.refund")}</Link>
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