import "./RotavoyLogo.css";

const LOGO_SRC = "/rotavoy-approved-logo.png?v=20261005-full-r";

function RotavoyLogo({ className = "", alt = "Rotavoy" }) {
  return (
    <img
      className={`rotavoyLogoImage ${className}`.trim()}
      src={LOGO_SRC}
      alt={alt}
      decoding="async"
    />
  );
}

export default RotavoyLogo;
