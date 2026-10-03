import { Link } from "react-router-dom";
import { FaFacebookF, FaInstagram, FaXTwitter, FaYoutube } from "react-icons/fa6";
import siteConfig from "../../config/site";
import "./Footer.css";

const paymentMethods = [
  { id: "visa", label: "Visa", display: "VISA" },
  { id: "mastercard", label: "Mastercard", display: "mastercard" },
  { id: "amex", label: "American Express", display: "AMEX" },
  { id: "discover", label: "Discover", display: "DISCOVER" },
  { id: "jcb", label: "JCB", display: "JCB" },
  { id: "diners", label: "Diners Club", display: "DINERS CLUB" },
  { id: "unionpay", label: "UnionPay", display: "UnionPay" },
  { id: "applepay", label: "Apple Pay", display: "Apple Pay" },
  { id: "googlepay", label: "Google Pay", display: "G Pay" },
  { id: "3dsecure", label: "3D Secure", display: "3D Secure" },
  { id: "usdt", label: "USDT on BNB Chain", display: "₮ USDT" },
  { id: "usdc", label: "USDC on BNB Chain", display: "◎ USDC" },
  { id: "bnb", label: "BNB on BNB Chain", display: "BNB" },
  { id: "eth", label: "ETH on Ethereum", display: "◆ ETH" },
];

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container footerInner">
        <div className="footerBrand">
          <Link to="/" className="footerLogo">
            <img className="approvedLogo" src="/rotavoy-approved-logo.png" alt={siteConfig.brandName} />
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

      <div className="container footerPayments">
        <div className="footerPaymentsIntro">
          <strong>Güvenli ödeme</strong>
          <span>Kart, dijital cüzdan ve kripto seçenekleri</span>
        </div>
        <div className="footerPaymentCards" aria-label="Rotavoy accepted payment methods">
          {paymentMethods.map((method) => (
            <span
              key={method.id}
              className={`footerPaymentCard footerPaymentCard--${method.id}`}
              aria-label={method.label}
              title={method.label}
            >
              {method.id === "mastercard" && <i className="mastercardMark" aria-hidden="true" />}
              {method.id === "3dsecure" && <i className="secureMark" aria-hidden="true">✓</i>}
              <b>{method.display}</b>
            </span>
          ))}
        </div>
        <p className="footerPaymentNote">
          Kart ve cüzdan kullanılabilirliği ödeme oturumunun para birimi, bölgesi ve sağlayıcı uygunluğuna göre değişebilir. Kripto ödemelerinde seçilen ağ doğru olmalıdır.
        </p>
      </div>

      <div className="container footerBottom">
        <p>© {currentYear} {siteConfig.brandName}. Travel platform.</p>
      </div>
    </footer>
  );
}

export default Footer;
