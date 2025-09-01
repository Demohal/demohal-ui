// src/hooks/useDemos.js
import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Load the demo browse list.
 * GET /browse-demos?bot_id=...
 *
 * Returns:
 *  items:        [{ id, title, url, description, functions_text }]
 *  loading:      boolean
 *  error:        string|""
 *  load():       Promise<void>
 */
export default function useDemos({
  apiBase = import.meta.env.VITE_API_URL || "https://demohal-app-dev.onrender.com",
  botId,
  autoLoad = true,
} = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hasBot = useMemo(() => Boolean((botId || "").trim()), [botId]);

  const normalize = useCallback((src) => {
    const arr = Array.isArray(src) ? src : [];
    return arr.map((it) => ({
      id: it.id ?? it.value ?? it.url ?? it.title,
      title: it.title ?? it.button_title ?? it.label ?? "",
      url: it.url ?? it.value ?? it.button_value ?? "",
      description: it.description ?? it.summary ?? it.functions_text ?? "",
      functions_text: it.functions_text ?? it.description ?? "",
    }));
  }, []);

  const load = useCallback(async () => {
    if (!hasBot) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/browse-demos?bot_id=${encodeURIComponent(botId)}`);
      const data = await res.json();
      const src = Array.isArray(data?.items) ? data.items : [];
      setItems(normalize(src));
    } catch {
      setError("Failed to load demos.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [apiBase, botId, hasBot, normalize]);

  useEffect(() => {
    if (!autoLoad || !hasBot) return;
    load();
  }, [autoLoad, hasBot, load]);

  return { items, loading, error, load };
}
