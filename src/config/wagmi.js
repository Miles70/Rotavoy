import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import {
  arbitrum,
  base,
  bsc,
  mainnet,
  polygon,
} from "@reown/appkit/networks";

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID;

if (!projectId) {
  throw new Error(
    "VITE_REOWN_PROJECT_ID is missing. Add it to your .env.local file.",
  );
}

export const networks = [mainnet, bsc, polygon, arbitrum, base];

const metadata = {
  name: "Rotavoy",
  description: "Shop, travel and discover with Web3.",
  url: window.location.origin,
  icons: [],
};

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
  ssr: false,
});

export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks,
  metadata,
  features: {
    analytics: true,
    email: false,
    socials: [],
  },
});
