import { useEffect, useMemo, useRef, useState } from "react";
import { CreditCard, LoaderCircle, ShieldCheck } from "lucide-react";

import "./NuiteeCardPayment.css";

const PAYMENT_SDK_SRC =
  "https://payment-wrapper.liteapi.travel/dist/liteAPIPayment.js?v=a1";

let paymentSdkPromise;

function loadPaymentSdk() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Payment SDK requires a browser."));
  }

  if (window.LiteAPIPayment) return Promise.resolve(window.LiteAPIPayment);
  if (paymentSdkPromise) return paymentSdkPromise;

  paymentSdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${PAYMENT_SDK_SRC}"]`);
    const script = existing || document.createElement("script");

    const timeout = setTimeout(() => handleError(), 20000);
    const handleLoad = () => {
      clearTimeout(timeout);
      if (window.LiteAPIPayment) {
        resolve(window.LiteAPIPayment);
        return;
      }
      paymentSdkPromise = undefined; script.remove();
      reject(new Error("Payment SDK loaded without LiteAPIPayment."));
    };

    const handleError = () => {
      clearTimeout(timeout); script.remove();
      paymentSdkPromise = undefined;
      reject(new Error("Secure payment SDK could not be loaded."));
    };

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });

    if (!existing) {
      script.src = PAYMENT_SDK_SRC;
      script.async = true;
      script.dataset.rotavoyNuiteePaymentSdk = "true";
      document.head.appendChild(script);
    }
  });

  return paymentSdkPromise;
}

function NuiteeCardPayment({ session, returnUrl }) {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const startedRef = useRef(false);
  const targetId = useMemo(
    () =>
      `nuitee-payment-${String(session?.clientReference || "session")
        .replace(/[^A-Za-z0-9_-]/g, "")}`,
    [session?.clientReference],
  );

  useEffect(() => {
    if (!session?.secretKey || !returnUrl || startedRef.current) return undefined;

    let cancelled = false;
    startedRef.current = true;
    setStatus("loading");
    setError("");

    loadPaymentSdk()
      .then((LiteAPIPayment) => {
        if (cancelled) return;

        const target = document.getElementById(targetId);
        if (!target) throw new Error("Payment form target could not be found.");
        target.replaceChildren();

        const payment = new LiteAPIPayment({
          publicKey: session.environment === "live" ? "live" : "sandbox",
          appearance: {
            theme: "flat",
          },
          options: {
            business: {
              name: "Rotavoy",
            },
          },
          targetElement: `#${targetId}`,
          secretKey: session.secretKey,
          returnUrl,
        });

        const maybePromise = payment.handlePayment();
        if (maybePromise && typeof maybePromise.catch === "function") {
          maybePromise.catch((paymentError) => {
            if (cancelled) return;
            setStatus("error");
            setError(paymentError?.message || "Kart ödeme formu başlatılamadı.");
          });
        }

        setStatus("ready");
      })
      .catch((paymentError) => {
        if (cancelled) return;
        setStatus("error");
        setError(paymentError?.message || "Kart ödeme formu yüklenemedi.");
      });

    return () => {
      cancelled = true;
      startedRef.current = false;
      const target = document.getElementById(targetId);
      if (target) target.replaceChildren();
    };
  }, [returnUrl, session?.environment, session?.secretKey, targetId]);

  return (
    <section className="nuiteeCardPanel" aria-live="polite">
      <div className="nuiteeCardPanelHeader">
        <div className="nuiteeCardIcon"><CreditCard size={22} /></div>
        <div>
          <span>Rotavoy Secure Payment</span>
          <h2>Kartla güvenli ödeme</h2>
        </div>

      </div>

      <p className="nuiteeCardIntro">
        Kart bilgilerin Rotavoy sunucusuna gönderilmez. Güvenli ödeme altyapısı kart bilgilerini işler; gerekiyorsa 3D Secure doğrulaması açılır.
      </p>

      {status === "loading" && (
        <div className="nuiteeCardLoading">
          <LoaderCircle className="travelSpin" size={20} /> Güvenli ödeme formu hazırlanıyor…
        </div>
      )}

      {error && <p className="nuiteeCardError">{error}</p>}
      <div id={targetId} className="nuiteeCardTarget" />


      <p className="nuiteeCardSecurity">
        <ShieldCheck size={17} /> Ödeme başarılı olduğunda Rotavoy&apos;a dönüp rezervasyonu otomatik olarak tamamlayacağız.
      </p>
    </section>
  );
}

export default NuiteeCardPayment;
