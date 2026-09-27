import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { AlertCircle, CreditCard, LoaderCircle, ShieldCheck } from "lucide-react";
import { finalizeTravelCardPayment } from "../../services/hotelsApi";
import "./TravelCardPayment.css";

function successfulPaymentStatus(status) {
  return status === "succeeded" || status === "requires_capture";
}

function paymentErrorMessage(error) {
  return (
    error?.message ||
    "Kart ödemesi tamamlanamadı. Bilgileri kontrol edip tekrar dene."
  );
}

function CardPaymentForm({
  booking,
  returnUrl,
  returnPaymentClientSecret,
  onOrderUpdated,
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [stage, setStage] = useState(returnPaymentClientSecret ? "checking" : "idle");
  const [error, setError] = useState("");
  const returnHandledRef = useRef(false);

  const finalizeBooking = useCallback(async (paymentIntentStatus) => {
    setStage("finalizing");
    setError("");

    try {
      const updatedBooking = await finalizeTravelCardPayment(
        booking.clientReference,
        { paymentIntentStatus },
      );
      onOrderUpdated(updatedBooking);
      setStage("paid");
    } catch (finalizeError) {
      setStage("error");
      setError(paymentErrorMessage(finalizeError));
    }
  }, [booking.clientReference, onOrderUpdated]);

  useEffect(() => {
    if (
      !returnPaymentClientSecret ||
      returnHandledRef.current ||
      booking.status === "confirmed"
    ) {
      return undefined;
    }

    if (!stripe) return undefined;

    returnHandledRef.current = true;
    let cancelled = false;

    async function verifyReturnedPayment() {
      setStage("checking");
      setError("");
      const result = await stripe.retrievePaymentIntent(returnPaymentClientSecret);

      if (cancelled) return;

      if (result.error) {
        setStage("error");
        setError(paymentErrorMessage(result.error));
        return;
      }

      const paymentIntentStatus = result.paymentIntent?.status;
      if (successfulPaymentStatus(paymentIntentStatus)) {
        await finalizeBooking(paymentIntentStatus);
        return;
      }

      if (paymentIntentStatus === "processing") {
        setStage("processing");
        setError("Kart ödemesi işleniyor. Birkaç saniye sonra tekrar kontrol edebilirsin.");
        return;
      }

      setStage("error");
      setError("Kart doğrulaması tamamlanmadı. Ödeme yöntemiyle tekrar deneyebilirsin.");
    }

    verifyReturnedPayment().catch((verifyError) => {
      if (cancelled) return;
      setStage("error");
      setError(paymentErrorMessage(verifyError));
    });

    return () => {
      cancelled = true;
    };
  }, [booking.status, finalizeBooking, returnPaymentClientSecret, stripe]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!stripe || !elements || stage === "processing" || stage === "finalizing") {
      return;
    }

    setStage("processing");
    setError("");

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    });

    if (result.error) {
      setStage("error");
      setError(paymentErrorMessage(result.error));
      return;
    }

    const paymentIntent = result.paymentIntent;
    if (paymentIntent && successfulPaymentStatus(paymentIntent.status)) {
      await finalizeBooking(paymentIntent.status);
      return;
    }

    setStage("processing");
    setError("Ödeme doğrulanıyor. 3D Secure adımı tamamlandıktan sonra rezervasyon hazırlanacak.");
  }

  const isBusy = ["checking", "processing", "finalizing"].includes(stage);

  return (
    <form className="travelCardPaymentForm" onSubmit={handleSubmit}>
      <div className="travelCardPaymentElement">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>
      {error && (
        <p className="travelCardPaymentError" role="alert">
          <AlertCircle size={17} /> {error}
        </p>
      )}
      <button className="travelCheckoutSubmit" disabled={!stripe || !elements || isBusy} type="submit">
        {isBusy ? <LoaderCircle className="travelSpin" size={19} /> : <CreditCard size={18} />}
        {stage === "finalizing" ? "Rezervasyon oluşturuluyor" : "Kartla güvenli öde"}
      </button>
      <p className="travelCheckoutSecurity">
        <ShieldCheck size={16} /> Kart bilgilerin Rotavoy sunucusuna ulaşmaz. Bankan gerek görürse 3D Secure doğrulaması açılır.
      </p>
    </form>
  );
}

function TravelCardPayment({
  booking,
  onOrderUpdated,
  returnPaymentClientSecret = "",
}) {
  const payment = booking?.payment || {};
  const clientSecret = returnPaymentClientSecret || payment.clientSecret || "";
  const publishableKey = payment.stripePublishableKey || "";
  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey],
  );

  if (!clientSecret || !publishableKey || !stripePromise) {
    return (
      <section className="travelCardPayment travelCardPayment--error">
        <p className="travelCardPaymentError" role="alert">
          <AlertCircle size={17} /> Kart ödeme altyapısı henüz etkinleştirilmemiş.
        </p>
      </section>
    );
  }

  const returnUrl = `${window.location.origin}/travel/checkout?booking=${encodeURIComponent(booking.clientReference)}`;

  return (
    <section className="travelCardPayment">
      <div className="travelCardPaymentHeading">
        <div className="travelCardPaymentIcon" aria-hidden="true">
          <CreditCard size={20} />
        </div>
        <div>
          <h2>Kartla güvenli ödeme</h2>
          <p>Ödeme, bankanın güvenlik doğrulamasıyla korunur.</p>
        </div>
      </div>
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
          appearance: {
            theme: "stripe",
            variables: {
              colorPrimary: "#087985",
              colorText: "#17363d",
              borderRadius: "10px",
            },
          },
        }}
      >
        <CardPaymentForm
          booking={booking}
          onOrderUpdated={onOrderUpdated}
          returnPaymentClientSecret={returnPaymentClientSecret}
          returnUrl={returnUrl}
        />
      </Elements>
    </section>
  );
}

export default TravelCardPayment;
