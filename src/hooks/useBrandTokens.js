// src/hooks/useBrandTokens.js
import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Fetch brand tokens (CSS vars) and brand assets (logos) for a bot.
 * Source: GET /brand?bot_id=...
 *
 * Params:
 *  - apiBase:   backend base URL
 *  - botId:     required to fetch brand
 *  - fallback:  optional object of default CSS vars
 *
 * Returns:
 *  - themeVars: object of CSS variables (key -> value)
 *  - assets:    { logo_url, logo_light_url, logo_dark_url }
 *  - loading:   boolean
 *  - error:     string | ""
 *  - refresh:   () => Promise<void>
 */
export default function useBrandTokens({
  apiBase = import.meta.env.VITE_API_URL || "https://demohal-app-dev.onrender.com",
  botId,
  fallback = {},
} = {}) {
  const [themeVars, setThemeVars] = useState(fallback);
  const [assets, setAssets] = useState({
    logo_url: null,
    logo_light_url: null,
    logo_dark_url: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hasBot = useMemo(() => Boolean((botId || "").trim()), [botId]);

  const fetchBrand = useCallback(async () => {
    if (!hasBot) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/brand?bot_id=${encodeURIComponent(botId)}`);
      const data = await res.json();
      if (data?.ok) {
        // Only tokens/colors live in css_vars; logos in assets.
        if (data.css_vars && typeof data.css_vars === "object") {
          setThemeVars((prev) => ({ ...prev, ...data.css_vars }));
        }
        const a = data.assets || {};
        setAssets({
          logo_url: a.logo_url || null,
          logo_light_url: a.logo_light_url || null,
          logo_dark_url: a.logo_dark_url || null,
        });
      } else {
        setError(data?.error || "Failed to load brand.");
      }
    } catch {
      setError("Failed to load brand.");
    } finally {
      setLoading(false);
    }
  }, [apiBase, botId, hasBot]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hasBot) return;
      await fetchBrand();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [hasBot, fetchBrand]);

  return {
    themeVars,
    assets,
    loading,
    error,
    refresh: fetchBrand,
  };
}
