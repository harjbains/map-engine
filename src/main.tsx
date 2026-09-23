import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";
import "maplibre-gl/dist/maplibre-gl.css";
import "./dashboard/dashboard.css";
import "./ported-map/globals.css";
import "./ported-map/map-engine.css";

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
