import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";

import "./utils/orderStorage";
import { LanguageProvider } from "./i18n/LanguageContext";
import { CartProvider } from "./context/CartContext";
import { CustomerAuthProvider } from "./context/CustomerAuthContext";
import { CustomerAccountProvider } from "./context/CustomerAccountContext";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import { wagmiAdapter } from "./config/wagmi";

import "./index.css";
import "./components/AuthModal/FirebaseAuthOptions.css";
import App from "./App.jsx";
import "./styles/RotavoySignature.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")).render(
  <WagmiProvider config={wagmiAdapter.wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LanguageProvider>
          <CustomerAuthProvider>
            <CustomerAccountProvider>
              <CartProvider>
                <AdminAuthProvider>
                  <App />
                </AdminAuthProvider>
              </CartProvider>
            </CustomerAccountProvider>
          </CustomerAuthProvider>
        </LanguageProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </WagmiProvider>,
);
