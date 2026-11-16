import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router";
import { AuthProvider } from "./auth";
import "./motion";
import App from "./App";
// Self-hosted fonts (OFL): Prompt (body + italic headings) and IBM Plex Mono (time, metadata)
import "@fontsource/prompt/thai-300.css";
import "@fontsource/prompt/thai-400.css";
import "@fontsource/prompt/thai-500.css";
import "@fontsource/prompt/thai-600.css";
import "@fontsource/prompt/thai-500-italic.css";
import "@fontsource/prompt/thai-600-italic.css";
import "@fontsource/prompt/latin-300.css";
import "@fontsource/prompt/latin-400.css";
import "@fontsource/prompt/latin-500.css";
import "@fontsource/prompt/latin-600.css";
import "@fontsource/prompt/latin-500-italic.css";
import "@fontsource/prompt/latin-600-italic.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./index.css";

// A data router (one splat route; App keeps its own <Routes>) so <Link viewTransition> and
// navigate(..., { viewTransition: true }) really run the View Transitions API — BrowserRouter ignores them.
const router = createBrowserRouter([
  {
    path: "*",
    element: (
      <AuthProvider>
        <App />
      </AuthProvider>
    ),
  },
]);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);

// Service worker (installable app + offline shell). Browsers only allow it on HTTPS or localhost;
// skipped in development so it doesn't fight with the dev server's hot reload.
if ("serviceWorker" in navigator && window.isSecureContext && process.env.NODE_ENV === "production") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => console.warn("service worker:", err));
  });
}
