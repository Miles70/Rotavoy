import { useId } from "react";
import "./RotavoyLogo.css";

const LOGO_SRC = "/brand/rotavoy-horizontal.png";

function RotavoyLogo({ className = "", alt = "Rotavoy" }) {
  const id = useId();
  const markId = `${id}-mark`;
  const wordmarkId = `${id}-wordmark`;

  return (
    <svg
      className={`rotavoyLogoImage ${className}`.trim()}
      viewBox="0 0 1942 809"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={alt}
    >
      <defs>
        <clipPath id={markId}>
          <path d="M0 0H1942V242H757V583H1942V809H0Z" />
        </clipPath>
        <clipPath id={wordmarkId}>
          <rect x="757" y="242" width="1185" height="341" />
        </clipPath>
      </defs>
      <image href={LOGO_SRC} width="1942" height="809" clipPath={`url(#${markId})`} />
      <g transform="translate(0 40)">
        <image href={LOGO_SRC} width="1942" height="809" clipPath={`url(#${wordmarkId})`} />
      </g>
    </svg>
  );
}

export default RotavoyLogo;
