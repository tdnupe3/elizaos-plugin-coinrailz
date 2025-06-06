import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Global error handling for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  event.preventDefault(); // Prevent default browser behavior
});

// Global error handling for general errors
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

createRoot(document.getElementById("root")!).render(<App />);
