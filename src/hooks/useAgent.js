// src/hooks/useAgent.js
import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Load scheduling agent details.
 * GET /agent?bot_id=...
 *
 * Returns:
 *  agent:    { schedule_header, calendar_link_type, calendar_link, ... } | null
 *  loading:  boolean
 *  error:    string|""
 *  refresh:  () => Promise<void>
 */
export default function useAgent({
  apiBase = import.meta.env.VITE_API_URL || "https://demohal-app-dev.onrender.com",
  botId,
  autoLoad = false, // call refresh() on entering Schedule tab
} = {}) {
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hasBot = useMemo(() => Boolean((botId || "").trim()), [botId]);

  const refresh = useCallback(async () => {
    if (!hasBot) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/agent?bot_id=${encodeURIComponent(botId)}`);
      const data = await res.json();
      const ag = data?.ok ? data.agent : null;
      setAgent(ag || null);
      if (!ag && data?.error) setError("No agent configured.");
    } catch {
      setError("Failed to load scheduling info.");
      setAgent(null);
    } finally {
      setLoading(false);
    }
  }, [apiBase, botId, hasBot]);

  useEffect(() => {
    if (!autoLoad || !hasBot) return;
    refresh();
  }, [autoLoad, hasBot, refresh]);

  return { agent, loading, error, refresh };
}
