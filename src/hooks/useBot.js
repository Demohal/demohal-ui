/* src/hooks/useBot.js */
import { useEffect, useState } from "react";
import { getBotByAlias } from "../lib/api";
import { applyTheme } from "../brand/applyTheme";

/**
 * Loads bot by alias and applies CSS theme variables.
 * Accepts API shapes: {id,...} or {bot:{...}}. Ignores client_id.
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

        // Prefer explicit fields
        let id =
          obj.id ||
          obj.bot_id ||
          obj.botId ||
          obj.uuid ||
          obj.uid ||
          "";

        // Fallback: scan for a UUID-like value in any "*id" field, excluding client_id
        if (!id) {
          const uuidLike = (v) =>
            typeof v === "string" && /^[0-9a-fA-F-]{36}$/.test(v);
          for (const [k, v] of Object.entries(obj)) {
            if (/id$/i.test(k) && !/client/i.test(k) && uuidLike(v)) {
              id = v;
              break;
            }
          }
        }

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
