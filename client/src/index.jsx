import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { AuthProvider } from "./auth";
import App from "./App";
// Self-hosted fonts (OFL): only the Thai + Latin subsets and the weights we use
import "@fontsource/chakra-petch/thai-500.css";
import "@fontsource/chakra-petch/thai-600.css";
import "@fontsource/chakra-petch/thai-700.css";
import "@fontsource/chakra-petch/latin-500.css";
import "@fontsource/chakra-petch/latin-600.css";
import "@fontsource/chakra-petch/latin-700.css";
import "@fontsource/ibm-plex-sans-thai/thai-400.css";
import "@fontsource/ibm-plex-sans-thai/thai-500.css";
import "@fontsource/ibm-plex-sans-thai/thai-600.css";
import "@fontsource/ibm-plex-sans-thai/latin-400.css";
import "@fontsource/ibm-plex-sans-thai/latin-500.css";
import "@fontsource/ibm-plex-sans-thai/latin-600.css";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);

// Service worker (installable app + offline shell). Browsers only allow it on HTTPS or localhost;
// skipped in development so it doesn't fight with the dev server's hot reload.
if ("serviceWorker" in navigator && window.isSecureContext && process.env.NODE_ENV === "production") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => console.warn("service worker:", err));
  });
}
