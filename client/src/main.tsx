import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializePromiseStabilizer } from "./lib/promiseStabilizer";

// Initialize comprehensive promise stabilization before any other code runs
initializePromiseStabilizer();

createRoot(document.getElementById("root")!).render(<App />);
