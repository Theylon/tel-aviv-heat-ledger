import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClimateDashboard } from "./components/climate-dashboard";
import weather from "./data/weather.json";
import "./globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing root element");
}

createRoot(root).render(
  <StrictMode>
    <ClimateDashboard data={weather} />
  </StrictMode>,
);
