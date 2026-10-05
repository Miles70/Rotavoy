import "./RotavoyLogo.css";

const LOGO_SRC = "/brand/rotavoy-horizontal.png";

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
