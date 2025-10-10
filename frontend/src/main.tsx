
  import { createRoot } from "react-dom/client";
  import App from "./App";
  import "./index.css";
  // Leaflet styles (used by ExploreMap)
  import 'leaflet/dist/leaflet.css';

  createRoot(document.getElementById("root")!).render(<App />);
  