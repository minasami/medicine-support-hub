import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./mobile-platform.css";
import { installTolerantUrlInputs } from "./lib/url-inputs";

installTolerantUrlInputs();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      console.warn("Medicine Support Hub service worker registration failed", error);
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
