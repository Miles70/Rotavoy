import "./VoyHavenLogo.css";

function VoyHavenLogo({ className = "", alt = "VoyHaven" }) {
  return (
    <svg className={`voyhavenLogoImage ${className}`.trim()} viewBox="0 0 310 72" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={alt}>
      <path d="M9 14h13l17 35 17-35h13L44 62H34Z" fill="#122c40" />
      <path d="m39 49 17-35h13L50 51Z" fill="#13b8a6" />
      <circle cx="65" cy="14" r="5" fill="#ff876c" />
      <text x="82" y="50" fill="#122c40" fontFamily="Inter, Arial, sans-serif" fontSize="41" fontWeight="650" letterSpacing="-1.8">VoyHaven</text>
    </svg>
  );
}

export default VoyHavenLogo;
