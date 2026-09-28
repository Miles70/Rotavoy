import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";

import { LanguageProvider } from "./i18n/LanguageContext";
import { CustomerAuthProvider } from "./context/CustomerAuthContext";
import { wagmiAdapter } from "./config/wagmi";

import "./index.css";
import "./components/AuthModal/FirebaseAuthOptions.css";
import App from "./App.jsx";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")).render(
  <WagmiProvider config={wagmiAdapter.wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LanguageProvider>
          <CustomerAuthProvider>
            <App />
          </CustomerAuthProvider>
        </LanguageProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </WagmiProvider>,
);
