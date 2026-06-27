import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/app/App";
import { AppProviders } from "@/app/AppProviders";
import "./styles/globals.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Elemento root nao encontrado.");
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
