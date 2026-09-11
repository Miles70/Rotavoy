import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import AdminProtectedRoute from "./components/admin/AdminProtectedRoute";
import AuthModal from "./components/AuthModal/AuthModal";
import CartToast from "./components/CartToast/CartToast";
import "./styles/store-products.css";
import "./styles/search-live.css";
import "./styles/product-rich-details.css";
import "./pages/CategoriesGroups.css";
import "./styles/admin.css";
import "./styles/admin-enhancements.css";
import "./styles/admin-pagination.css";
import "./styles/admin-order-deletion.css";
import "./components/admin/AdminCampaignSettings.css";
import "./components/CampaignShowcase/CampaignCinematic.css";

const Home = lazy(() => import("./pages/Home"));
const Categories = lazy(() => import("./pages/Categories"));
const Products = lazy(() => import("./pages/Products"));
const ProductDetailsLive = lazy(() => import("./pages/ProductDetailsLive"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const OrderSuccess = lazy(() => import("./pages/OrderSuccess"));
const CustomerAccount = lazy(() => import("./pages/CustomerAccount"));
const Travel = lazy(() => import("./pages/Travel"));
const LocalHub = lazy(() => import("./pages/LocalHub"));
const LocalService = lazy(() => import("./pages/LocalService"));
const InformationPage = lazy(() => import("./pages/InformationPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminLayout = lazy(() => import("./layouts/AdminLayout"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));

function RouteFallback() {
  return (
    <main className="routeFallback" aria-live="polite">
      <span className="routeFallbackSpinner" aria-hidden="true" />
      <p>Rotavoy yükleniyor…</p>
    </main>
  );
}

function App() {
  return (
    <>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/:productKey" element={<ProductDetailsLive />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order-success" element={<OrderSuccess />} />
            <Route path="/travel" element={<Travel />} />
            <Route path="/local" element={<LocalHub />} />
            <Route path="/local/:serviceKey" element={<LocalService />} />
            <Route path="/account/*" element={<CustomerAccount />} />
            <Route path="/about" element={<InformationPage page="about" />} />
            <Route path="/contact" element={<InformationPage page="contact" />} />
            <Route path="/support" element={<InformationPage page="support" />} />
            <Route path="/privacy" element={<InformationPage page="privacy" />} />
            <Route path="/terms" element={<InformationPage page="terms" />} />
            <Route path="/refund" element={<InformationPage page="refund" />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          <Route path="/admin/login" element={<AdminLogin />} />
          <Route element={<AdminProtectedRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>

      <AuthModal />
      <CartToast />
    </>
  );
}

export default App;
