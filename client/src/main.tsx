import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeErrorHandling } from "./lib/errorHandler";

// Initialize single error handling system
initializeErrorHandling();

createRoot(document.getElementById("root")!).render(<App />);
