import React, { useEffect, useMemo, useState } from "react";

export default function AskAssistant() {
  const apiBase = import.meta.env.VITE_API_URL || "https://demohal-app.onrender.com";

  // read alias/bot_id from URL (if any)
  const { alias, botIdFromUrl } = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    return {
      alias: (qs.get("alias") || qs.get("alais") || "").trim(),
      botIdFromUrl: (qs.get("bot_id") || "").trim(),
    };
  }, []);

  const defaultAlias = (import.meta.env.VITE_DEFAULT_ALIAS || "").trim();
  const [text, setText] = useState("Boot…");

  useEffect(() => {
    const useAlias = alias || defaultAlias;
    if (!useAlias && !botIdFromUrl) {
      setText("Invalid or inactive alias.");
      return;
    }
    const url = botIdFromUrl
      ? `${apiBase}/bot-settings?bot_id=${encodeURIComponent(botIdFromUrl)}`
      : `${apiBase}/bot-settings?alias=${encodeURIComponent(useAlias)}`;
    setText(`Fetching ${url}`);
    fetch(url)
      .then(r => r.json().catch(() => ({})).then(j => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok || j?.ok === false || !j?.bot?.id) {
          setText("Invalid or inactive alias.");
        } else {
          const b = j.bot || {};
          setText(b.welcome_message || "OK");
        }
      })
      .catch(() => setText("Invalid or inactive alias."));
  }, [apiBase, alias, botIdFromUrl, defaultAlias]);

  return <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>{text}</div>;
}
