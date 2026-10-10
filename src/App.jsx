import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import AuthModal from "./components/AuthModal/AuthModal";

const FlightCheckout = lazy(() => import("./pages/FlightCheckout"));
const TravelAccount = lazy(() => import("./pages/TravelAccount"));
const TravelAdmin = lazy(() => import("./pages/TravelAdmin"));
const CategoryPage = lazy(() => import("./pages/CategoryPage"));
const Flights = lazy(() => import("./pages/Flights"));
const Travel = lazy(() => import("./pages/Travel"));
const HotelDetails = lazy(() => import("./pages/HotelDetails"));
const TravelCheckout = lazy(() => import("./pages/TravelCheckout"));
const InformationPage = lazy(() => import("./pages/InformationPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

function RouteFallback() {
  return (
    <main className="routeFallback" aria-live="polite">
      <span className="routeFallbackSpinner" aria-hidden="true" />
      <p>VoyHaven Travel yükleniyor…</p>
    </main>
  );
}

function App() {
  return (
    <>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/admin/dashboard" element={<Navigate to="/admin" replace />} />
          <Route path="/admin/*" element={<TravelAdmin />} />
          <Route element={<MainLayout />}>
            <Route path="/" element={<Travel />} />
            <Route path="/travel" element={<Travel />} />
            <Route path="/hotels" element={<Travel key="hotels" hotelsOnly />} />
            <Route path="/cars" element={<CategoryPage key="cars" category="cars" />} />
            <Route path="/activities" element={<CategoryPage key="activities" category="activities" />} />
            <Route path="/flights/checkout" element={<FlightCheckout />} />
            <Route path="/flights" element={<Flights />} />
            <Route path="/travel/hotels/:hotelId" element={<HotelDetails />} />
            <Route path="/travel/checkout" element={<TravelCheckout />} />
            <Route path="/account" element={<TravelAccount />} />
            <Route path="/about" element={<InformationPage page="about" />} />
            <Route path="/contact" element={<InformationPage page="contact" />} />
            <Route path="/support" element={<InformationPage page="support" />} />
            <Route path="/privacy" element={<InformationPage page="privacy" />} />
            <Route path="/terms" element={<InformationPage page="terms" />} />
            <Route path="/refund" element={<InformationPage page="refund" />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>

      <AuthModal />
    </>
  );
}

export default App;
