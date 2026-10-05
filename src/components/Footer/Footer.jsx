import { Link } from "react-router-dom";
import { FaFacebookF, FaInstagram, FaXTwitter, FaYoutube } from "react-icons/fa6";
import siteConfig from "../../config/site";
import "./Footer.css";
import RotavoyLogo from "../Brand/RotavoyLogo";

const cardPaymentMethods = [
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
];

const cryptoPaymentMethods = [
  { id: "usdt", label: "USDT on BNB Chain or Ethereum", display: "₮ USDT", network: "BSC · ETH" },
  { id: "usdc", label: "USDC on BNB Chain or Ethereum", display: "◎ USDC", network: "BSC · ETH" },
  { id: "bnb", label: "BNB on BNB Chain", display: "BNB", network: "BNB Chain" },
  { id: "eth", label: "ETH on Ethereum", display: "◆ ETH", network: "Ethereum" },
];

function PaymentCard({ method }) {
  return (
    <span
      className={`footerPaymentCard footerPaymentCard--${method.id}`}
      aria-label={method.label}
      title={method.label}
    >
      {method.id === "mastercard" && (
        <i className="mastercardMark" aria-hidden="true" />
      )}
      {method.id === "3dsecure" && (
        <i className="secureMark" aria-hidden="true">✓</i>
      )}
      <b>{method.display}</b>
      {method.network && <small>{method.network}</small>}
    </span>
  );
}

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

      <div className="container footerPayments">
        <div className="footerPaymentSections">
          <section className="footerPaymentSection" aria-labelledby="footer-card-payments-title">
            <div className="footerPaymentsIntro">
              <strong id="footer-card-payments-title">Payment Methods</strong>
              <span>Kart ve dijital cüzdan</span>
            </div>
            <div className="footerPaymentCards" aria-label="Rotavoy accepted card and wallet payment methods">
              {cardPaymentMethods.map((method) => (
                <PaymentCard key={method.id} method={method} />
              ))}
            </div>
          </section>

          <section className="footerPaymentSection footerCryptoPayments" aria-labelledby="footer-crypto-payments-title">
            <div className="footerPaymentsIntro">
              <strong id="footer-crypto-payments-title">Crypto Payments</strong>
              <span>BNB Chain & Ethereum</span>
            </div>
            <div className="footerPaymentCards footerCryptoPaymentCards" aria-label="Rotavoy accepted crypto payment methods">
              {cryptoPaymentMethods.map((method) => (
                <PaymentCard key={method.id} method={method} />
              ))}
            </div>
          </section>
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
