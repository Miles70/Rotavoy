import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import "./InformationPage.css";

function NotFound() {
  const { language } = useLanguage();
  const isTurkish = language === "tr";

  return (
    <main className="informationPage container">
      <p className="informationEyebrow">404</p>
      <h1>{isTurkish ? "Bu rota kaybolmuş." : "This route got lost."}</h1>
      <p>{isTurkish ? "Aradığın sayfa taşınmış veya hiç var olmamış olabilir." : "The page may have moved or may never have existed."}</p>
      <Link to="/" className="informationBack">← {isTurkish ? "Ana sayfaya dön" : "Back to home"}</Link>
    </main>
  );
}

export default NotFound;
