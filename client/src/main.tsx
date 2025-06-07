import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { productionStabilizer } from "./lib/productionStabilizer";
import "./lib/viteStabilizer";

// Initialize production stabilizer to eliminate development artifacts
console.log("Production stabilizer initialized");

// Initialize comprehensive promise stabilization
import { initializePromiseStabilizer } from "./lib/promiseStabilizer";
initializePromiseStabilizer();

createRoot(document.getElementById("root")!).render(<App />);
