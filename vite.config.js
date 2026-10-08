import { readFileSync, readdirSync } from "node:fs";
import { eligibleHotel } from "./seo/model.js";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const seoHotelIds = readdirSync(new URL("./seo/hotels", import.meta.url)).filter(name => name.endsWith(".json")).map(name => JSON.parse(readFileSync(new URL(`./seo/hotels/${name}`, import.meta.url), "utf8"))).filter(eligibleHotel).map(hotel => hotel.id);

export default defineConfig({
  define: { "import.meta.env.VITE_SEO_HOTEL_IDS": JSON.stringify(seoHotelIds) },
  plugins: [react()],
  build: { rollupOptions: { input: { app: "index.html", seo: "seo.html" } } },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
