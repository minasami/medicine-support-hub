import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./mobile-platform.css";
import { installTolerantUrlInputs } from "./lib/url-inputs";

installTolerantUrlInputs();

// Appwrite serves generated static route entry points as directory URLs. Keep
// the browser URL aligned with Wouter's canonical route definitions.
if (window.location.pathname.length > 1 && window.location.pathname.endsWith("/")) {
  const canonicalPath = window.location.pathname.replace(/\/+$/, "");
  window.history.replaceState(null, document.title, `${canonicalPath}${window.location.search}${window.location.hash}`);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      console.warn("Medicine Support Hub service worker registration failed", error);
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
