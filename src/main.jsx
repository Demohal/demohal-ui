import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Simple runtime check (harmless). You can remove later.
if (typeof window !== 'undefined') {
  try {
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    const versions = hook
      ? [...new Set(Object.values(hook.renderers || {}).map(r => r.version).filter(Boolean))]
      : [];
    console.log('[Runtime React versions]', versions);
  } catch {
    // ignore
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
