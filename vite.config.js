import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import vercel from "./vercel.json";

// `npm run preview` serves the production build with the same security headers
// Vercel sends (vercel.json is the single source), so CSP problems show up locally.
const securityHeaders = Object.fromEntries(vercel.headers[0].headers.map(({ key, value }) => [key, value]));

export default defineConfig({
  plugins: [
    react(),
    // Offline mode: a service worker keeps a copy of the whole app on the phone,
    // so it opens in a tent with no signal. New versions install on next launch.
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "script",      // external registerSW.js — no inline script, CSP stays strict
      manifest: false,               // we ship our own public/manifest.webmanifest
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,woff,woff2,webmanifest}"],
        navigateFallbackDenylist: [/^\/(terms|privacy)\.html$/],
      },
    }),
  ],
  preview: { headers: securityHeaders },
});
