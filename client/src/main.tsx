// Import polyfills first
import './polyfills';
import { setupBitteProxy } from './lib/setupBitteProxy';

// Initialize the BITTE API proxy
setupBitteProxy();

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
