/* src/hooks/useBot.js */
import { useEffect, useState } from "react";
import { getBotByAlias } from "../lib/api";
import { applyTheme } from "../brand/applyTheme";

/**
 * Loads bot by alias and applies CSS theme variables.
 * Accepts API shapes: {id,...} or {bot:{...}}
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
        const obj = b || {};

        // Be liberal in what we accept for the identifier
        const idCandidates = [
          obj.id,
          obj.bot_id,
          obj.botId,
          obj.client_id, // your API currently shows this field
          obj.uuid,
          obj.uid,
        ];
        const id = idCandidates.find(Boolean) || "";

        setBot(obj);
        setBotId(id);

        // Apply theme if present
        if (obj.theme) applyTheme(obj.theme);
      })
      .catch((e) => alive && setError(e.message));

    return () => {
      alive = false;
    };
  }, [apiBase, alias]);

  return { bot, botId, error };
}
