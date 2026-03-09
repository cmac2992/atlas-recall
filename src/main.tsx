import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./styles.css";
import "./styles/theme1.css";
import "./styles/theme2.css";
import "./styles/theme3.css";
import "./styles/theme4.css";
import "./styles/theme5.css";
import "./styles/theme6.css";
import "./styles/theme7.css";

const pathTheme = window.location.pathname.match(/^\/([1-7])\/?$/)?.[1];
if (pathTheme) {
  document.documentElement.dataset.theme = pathTheme;
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found.");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
