import { useEffect, useState } from "react";
import { getBotByAlias } from "../lib/api";
import { applyTheme } from "../brand/applyTheme";

/**
 * Loads bot by alias and applies CSS theme variables.
 */
export function useBot(apiBase, alias) {
  const [bot, setBot] = useState(null);
  const [botId, setBotId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!alias) return;
    let alive = true;
    getBotByAlias(apiBase, alias)
      .then((b) => {
        if (!alive) return;
        setBot(b);
        setBotId(b?.id || b?.bot_id || "");
        if (b?.theme) applyTheme(b.theme);
      })
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [apiBase, alias]);

  return { bot, botId, error };
}
