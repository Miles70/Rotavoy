import { Link } from "react-router-dom";
import { FaFacebookF, FaInstagram, FaXTwitter, FaYoutube } from "react-icons/fa6";
import siteConfig from "../../config/site";
import "./Footer.css";
import RotavoyLogo from "../Brand/RotavoyLogo";

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container footerInner">
        <div className="footerBrand">
          <Link to="/" className="footerLogo">
            <RotavoyLogo className="footerRotavoyLogo" alt={siteConfig.brandName} />
          </Link>

          <p>{siteConfig.description}</p>

          <div className="socialLinks" aria-label="Rotavoy social channels">
            <span aria-label="Facebook"><FaFacebookF /></span>
            <span aria-label="Instagram"><FaInstagram /></span>
            <span aria-label="X"><FaXTwitter /></span>
            <span aria-label="YouTube"><FaYoutube /></span>
          </div>
        </div>

        <div className="footerColumn">
          <h3>Travel</h3>
          <Link to="/">Hotels</Link>
          <Link to="/support">Reservation support</Link>
          <Link to="/refund">Cancellation & refunds</Link>
        </div>

        <div className="footerColumn">
          <h3>Rotavoy</h3>
          <Link to="/about">About</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/support">Support</Link>
        </div>

        <div className="footerColumn">
          <h3>Legal</h3>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/refund">Refund policy</Link>
        </div>
      </div>

      <div className="container footerPayments"><p>Seyahat tercihlerini paylaş, sana özel teklif hazırlayalım.</p><Link to="/request">Rezervasyon talebi gönder</Link></div>

      <div className="container footerBottom">
        <p>© {currentYear} {siteConfig.brandName}. Travel platform.</p>
      </div>
    </footer>
  );
}

export default Footer;
