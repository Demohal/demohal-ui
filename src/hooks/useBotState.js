// src/hooks/useBotState.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Resolve the active bot (by bot_id or alias) and expose UI flags + copy.
 *
 * Data source: GET /bot-settings
 *   - by alias:   /bot-settings?alias=...
 *   - by bot_id:  /bot-settings?bot_id=...
 *
 * Returns:
 *   botId                string
 *   setBotId             setter (rarely needed)
 *   loading              boolean (true while resolving)
 *   fatal                string | ""  (fatal error to show a blocking message)
 *   tabsEnabled          { demos, docs, meeting, price }
 *   welcomeMessage       string
 *   introVideoUrl        string
 *   showIntroVideo       boolean
 *   bot                  object | null (raw bot row, passthrough)
 *   refresh              () => Promise<void>  (re-fetch current bot settings)
 */
export default function useBotState(options = {}) {
  const {
    apiBase = import.meta.env.VITE_API_URL || "https://demohal-app-dev.onrender.com",
    initialBotId = "",
    initialAlias = "",
    defaultAlias = (import.meta.env.VITE_DEFAULT_ALIAS || "demo").trim(),
  } = options;

  const [botId, setBotId] = useState((initialBotId || "").trim());
  const [fatal, setFatal] = useState("");
  const [loading, setLoading] = useState(false);

  const [tabsEnabled, setTabsEnabled] = useState({
    demos: false,
    docs: false,
    meeting: false,
    price: false,
  });

  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [introVideoUrl, setIntroVideoUrl] = useState("");
  const [showIntroVideo, setShowIntroVideo] = useState(false);
  const [bot, setBot] = useState(null);

  const aliasMemo = useMemo(() => (initialAlias || "").trim(), [initialAlias]);
  const hasResolvedOnceRef = useRef(false);

  // --- internal fetchers -----------------------------------------------------

  const fetchByAlias = useCallback(async (alias) => {
    if (!alias) return null;
    const res = await fetch(`${apiBase}/bot-settings?alias=${encodeURIComponent(alias)}`);
    return res.json();
  }, [apiBase]);

  const fetchById = useCallback(async (id) => {
    if (!id) return null;
    const res = await fetch(`${apiBase}/bot-settings?bot_id=${encodeURIComponent(id)}`);
    return res.json();
  }, [apiBase]);

  const applyBotRow = useCallback((b) => {
    if (!b) return;

    setTabsEnabled({
      demos: !!b.show_browse_demos,
      docs: !!b.show_browse_docs,
      meeting: !!b.show_schedule_meeting,
      price: !!b.show_price_estimate,
    });

    setWelcomeMessage(b.welcome_message || "");
    setIntroVideoUrl(b.intro_video_url || "");
    setShowIntroVideo(!!b.show_intro_video);
    setBot(b);
  }, []);

  // --- public refresh --------------------------------------------------------

  const refresh = useCallback(async () => {
    if (!botId) return;
    try {
      setLoading(true);
      const data = await fetchById(botId);
      const b = data?.ok ? data.bot : null;
      if (b) applyBotRow(b);
    } finally {
      setLoading(false);
    }
  }, [botId, fetchById, applyBotRow]);

  // --- initial resolve flow --------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // If we already have a botId, just load by id (and mark resolved).
      if (botId) {
        try {
          setLoading(true);
          const data = await fetchById(botId);
          if (cancelled) return;
          const b = data?.ok ? data.bot : null;
          if (b) {
            applyBotRow(b);
            setFatal("");
          } else if (!data?.ok) {
            setFatal("Invalid or inactive bot.");
          }
        } catch {
          if (!cancelled) setFatal("Unable to resolve bot.");
        } finally {
          if (!cancelled) {
            setLoading(false);
            hasResolvedOnceRef.current = true;
          }
        }
        return;
      }

      // Otherwise resolve by alias → fall back to defaultAlias
      const aliasToUse = aliasMemo || defaultAlias;
      if (!aliasToUse) {
        // No botId and no alias provided; leave as-is for the host app to handle.
        return;
      }

      try {
        setLoading(true);
        const data = await fetchByAlias(aliasToUse);
        if (cancelled) return;
        const b = data?.ok ? data.bot : null;

        if (!b) {
          setFatal("Invalid or inactive alias.");
          return;
        }

        setBotId(b.id);
        applyBotRow(b);
        setFatal("");
      } catch {
        if (!cancelled) setFatal("Invalid or inactive alias.");
      } finally {
        if (!cancelled) {
          setLoading(false);
          hasResolvedOnceRef.current = true;
        }
      }
    })();

    return () => { cancelled = true; };
  }, [botId, aliasMemo, defaultAlias, fetchByAlias, fetchById, applyBotRow]);

  // --- derive a default title for the banner (optional helper) --------------

  const titleFor = useCallback((mode, selected) => {
    if (selected?.title) return selected.title;
    switch (mode) {
      case "browse":  return "Browse Demos";
      case "docs":    return "Browse Documents";
      case "price":   return "Price Estimate";
      case "meeting": return "Schedule Meeting";
      default:        return "Ask the Assistant";
    }
  }, []);

  return {
    // identity / status
    botId,
    setBotId,
    loading,
    fatal,

    // ui flags + copy
    tabsEnabled,
    welcomeMessage,
    introVideoUrl,
    showIntroVideo,
    bot,

    // helpers
    refresh,
    titleFor,
  };
}
