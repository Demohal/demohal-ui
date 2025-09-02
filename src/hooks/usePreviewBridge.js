// src/hooks/usePreviewBridge.js
import { useEffect, useState } from "react";

/**
 * Listens for postMessage events from the ThemeLab and exposes a CSS var overlay.
 * Only active when `enabled === true` (i.e., URL has ?preview=1).
 *
 * Supported messages (same-origin only):
 *  - { type: "preview:theme",  payload: { vars: { "--banner-bg": "#123456", ... } } }
 *  - { type: "preview:go",     payload: { screen: "intro"|"ask"|"browse"|"view_demo"|"docs"|"view_doc"|"price_questions"|"price_results"|"meeting" } }
 *  - { type: "preview:reload" }
 */
export default function usePreviewBridge({ enabled, goTo, reloadBrand }) {
  const [previewVars, setPreviewVars] = useState({});

  useEffect(() => {
    if (!enabled) {
      setPreviewVars({});
      return;
    }
    function onMsg(e) {
      // safety: same-origin only
      if (e.origin !== window.location.origin) return;
      const { type, payload } = e.data || {};
      if (type === "preview:theme") {
        const vars = (payload && payload.vars) || {};
        setPreviewVars((prev) => ({ ...prev, ...vars }));
      } else if (type === "preview:go") {
        if (payload && payload.screen && typeof goTo === "function") goTo(payload.screen);
      } else if (type === "preview:reload") {
        if (typeof reloadBrand === "function") reloadBrand();
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [enabled, goTo, reloadBrand]);

  return { previewVars, clearPreview: () => setPreviewVars({}) };
}
